import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PerfilUsuario, Prisma, StatusReserva } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreateCheckOutDto, ListCheckoutsQueryDto } from './dto/checkout.dto';

/** Situação exibida na central — derivada do `CheckOut`, nunca persistida. */
export type SituacaoCheckout =
  | 'REALIZADO'
  | 'ATRASADO'
  | 'SAIDA_HOJE'
  | 'HOSPEDADO';

/** Fuso do dia operacional (RN não tem horário de verão: UTC-3 fixo). */
const FUSO_OPERACIONAL = 'America/Fortaleza';
const DIA_MS = 86_400_000;
/** 00:00 em Fortaleza (UTC-3) = 03:00Z — usado nas janelas de `Timestamptz`. */
const DESLOCAMENTO_FUSO_MS = 3 * 60 * 60 * 1000;
/** Tolerância de relógio para aceitar `realizadoEm` "no futuro". */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;
/** Pagamento só conta como pago quando confirmado (critério do check-in). */
const STATUS_PAGAMENTO_CONFIRMADO = 'CONFIRMADO';

/** Include enxuto da central (sem peso de estabelecimento/fotos/avaliação). */
const INCLUDE_LISTA = {
  hospede: { select: { id: true, nome: true, email: true, telefone: true } },
  quarto: { select: { id: true, nome: true, capacidade: true } },
  pagamento: true,
  checkin: {
    select: {
      id: true,
      realizadoEm: true,
      observacoes: true,
      responsavel: { select: { id: true, nome: true } },
    },
  },
  checkout: {
    select: {
      id: true,
      realizadoEm: true,
      observacoes: true,
      responsavel: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.ReservaInclude;

/** Include do detalhe: perfil cadastral, tipo de acomodação, hóspedes e check-out. */
const INCLUDE_DETALHE = {
  hospede: {
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      // Perfil cadastral do hóspede (serializado como `hospedePerfil` na resposta).
      hospede: {
        select: {
          cpf: true,
          rg: true,
          dataNascimento: true,
          nacionalidade: true,
          contatoEmergencia: true,
          endereco: true,
        },
      },
    },
  },
  quarto: {
    select: {
      id: true,
      nome: true,
      capacidade: true,
      tipoAcomodacao: { select: { id: true, nome: true } },
    },
  },
  estabelecimento: { select: { id: true, nome: true } },
  pagamento: true,
  checkin: {
    select: {
      id: true,
      realizadoEm: true,
      observacoes: true,
      responsavel: { select: { id: true, nome: true } },
      hospedes: { orderBy: [{ principal: 'desc' }, { criadoEm: 'asc' }] },
    },
  },
  checkout: {
    select: {
      id: true,
      realizadoEm: true,
      observacoes: true,
      responsavel: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.ReservaInclude;

/**
 * Include mínimo para validar o POST. Os escalares necessários (`status`,
 * `checkIn`, `checkOut`, `estabelecimentoId`) vêm junto com o `include` — por
 * isso só as relações aparecem aqui.
 */
const INCLUDE_PRE = {
  checkin: { select: { id: true, realizadoEm: true } },
  checkout: { select: { id: true } },
} satisfies Prisma.ReservaInclude;

type ReservaLista = Prisma.ReservaGetPayload<{ include: typeof INCLUDE_LISTA }>;
type ReservaDetalhe = Prisma.ReservaGetPayload<{
  include: typeof INCLUDE_DETALHE;
}>;
type ReservaPreCheckOut = Prisma.ReservaGetPayload<{
  include: typeof INCLUDE_PRE;
}>;

interface EscopoEstabelecimento {
  admin: boolean;
  /** `null` = ADMIN sem filtro (todos os estabelecimentos). */
  idsPermitidos: string[] | null;
}

export interface ResultadoElegibilidade {
  elegivel: boolean;
  /** Texto humano em pt-BR exibido direto na UI. */
  motivo: string | null;
  /** Código estável para máquina/telemetria (a UI ignora). */
  codigo: string | null;
}

export interface AvisoCheckOut {
  codigo: string;
  mensagem: string;
}

/** Forma comum dos registros de check-in e check-out (idêntica nos dois). */
interface RegistroOperacao {
  id: string;
  realizadoEm: Date;
  observacoes: string | null;
  responsavel: { id: string; nome: string } | null;
}

@Injectable()
export class CheckoutsService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. Central de check-outs
  // ---------------------------------------------------------------------------

  async list(query: ListCheckoutsQueryDto, userId: string, perfil: string) {
    // Clamp defensivo: o DTO já valida, mas o `take` nunca pode virar ilimitado.
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const hoje = this.hojeUTC();

    const escopo = await this.resolverEscopo(userId, perfil);
    const estabelecimentoIds = this.resolverIdsDaConsulta(
      query.estabelecimentoId,
      escopo,
    );

    // Escopo apurado sem nenhum estabelecimento: resposta vazia (não é erro).
    if (estabelecimentoIds !== null && estabelecimentoIds.length === 0) {
      return this.respostaVazia(page, limit);
    }

    const whereEscopo: Prisma.ReservaWhereInput = estabelecimentoIds
      ? { estabelecimentoId: { in: estabelecimentoIds } }
      : {};
    const whereLista = this.montarWhereLista(whereEscopo, query, hoje);

    // Ordenação determinística: realizados pelo mais recente, o resto pela saída.
    const orderBy: Prisma.ReservaOrderByWithRelationInput[] =
      query.situacao === 'REALIZADOS'
        ? [{ checkout: { realizadoEm: 'desc' } }]
        : [{ checkOut: 'asc' }, { criadoEm: 'asc' }];

    const whereResumo: Prisma.ReservaWhereInput = {
      ...whereEscopo,
      status: { not: StatusReserva.CANCELADA },
    };
    // `realizadoEm` é Timestamptz: o dia operacional de Fortaleza começa às
    // 03:00Z e termina às 03:00Z do dia seguinte (check-out às 22h locais conta
    // como hoje). As colunas `@db.Date` (checkIn/checkOut) seguem em meia-noite UTC.
    const { inicio: inicioDiaOperacional, fim: fimDiaOperacional } =
      this.janelaDiaOperacional(hoje);

    const [
      reservas,
      total,
      emAndamento,
      saidasHoje,
      atrasados,
      realizadosHoje,
    ] = await Promise.all([
      this.prisma.reserva.findMany({
        where: whereLista,
        skip: (page - 1) * limit,
        take: limit,
        include: INCLUDE_LISTA,
        orderBy,
      }),
      this.prisma.reserva.count({ where: whereLista }),
      // `resumo` ignora busca/data/situacao: é o cabeçalho do escopo.
      this.prisma.reserva.count({
        where: {
          AND: [
            whereResumo,
            { checkin: { isNot: null }, checkout: { is: null } },
          ],
        },
      }),
      this.prisma.reserva.count({
        where: {
          AND: [
            whereResumo,
            {
              checkin: { isNot: null },
              checkout: { is: null },
              checkOut: hoje,
            },
          ],
        },
      }),
      this.prisma.reserva.count({
        where: {
          AND: [
            whereResumo,
            {
              checkin: { isNot: null },
              checkout: { is: null },
              checkOut: { lt: hoje },
            },
          ],
        },
      }),
      this.prisma.reserva.count({
        where: {
          AND: [
            whereResumo,
            {
              checkout: {
                realizadoEm: {
                  gte: inicioDiaOperacional,
                  lt: fimDiaOperacional,
                },
              },
            },
          ],
        },
      }),
    ]);

    return {
      data: reservas.map((reserva) => this.mapearItemLista(reserva, hoje)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      resumo: { emAndamento, saidasHoje, atrasados, realizadosHoje },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Detalhe / conferência de saída
  // ---------------------------------------------------------------------------

  async detail(reservaId: string, userId: string, perfil: string) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: INCLUDE_DETALHE,
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    const escopo = await this.resolverEscopo(userId, perfil);
    this.assertPosse(
      reserva.estabelecimentoId,
      escopo,
      'Sem permissão para acessar esta hospedagem',
    );

    const hoje = this.hojeUTC();
    // Mesma base da listagem e da auditoria: dia operacional do check-out quando
    // houver; senão hoje. Sem `checkin` a estadia nem começou e não há aviso de
    // antecipação/posterioridade (o caso é inelegível por `CHECKIN_NAO_REALIZADO`).
    const diaReferencia = this.resolverDiaReferencia(reserva, hoje);
    const elegibilidade = this.calcularElegibilidade(reserva);
    const financeiro = this.calcularFinanceiro(reserva);

    return {
      reserva: this.mapearReservaDetalhe(reserva),
      checkin: this.mapearCheckinDetalhe(reserva.checkin),
      checkout: this.mapearRegistro(reserva.checkout),
      elegivel: elegibilidade.elegivel,
      motivoInelegibilidade: elegibilidade.motivo,
      codigoInelegibilidade: elegibilidade.codigo,
      avisos: this.calcularAvisos(reserva, diaReferencia, financeiro),
      financeiro,
      acomodacao: await this.montarAcomodacao(reserva),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Registro do check-out
  // ---------------------------------------------------------------------------

  async create(
    dto: CreateCheckOutDto,
    userId: string,
    perfil: string,
    enderecoIp?: string,
  ) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: dto.reservaId },
      include: INCLUDE_PRE,
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    const escopo = await this.resolverEscopo(userId, perfil);
    this.assertPosse(
      reserva.estabelecimentoId,
      escopo,
      'Sem permissão para realizar check-out nesta reserva',
    );

    // Pré-checagens fora da transação (a corrida real é fechada pela unique de
    // `CheckOut.reservaId` + rechecagem dentro da transação).
    if (reserva.status === StatusReserva.CANCELADA) {
      throw new BadRequestException(
        'Reserva cancelada — não é possível realizar check-out',
      );
    }
    if (!reserva.checkin) {
      throw new BadRequestException(
        'A hospedagem ainda não realizou check-in — registre o check-in antes do check-out',
      );
    }
    if (reserva.checkout) {
      throw new ConflictException('Check-out já realizado para esta reserva');
    }

    const realizadoEm = this.resolverRealizadoEm(dto.realizadoEm, reserva);
    const observacoes = this.textoOuNulo(dto.observacoes);

    // Derivados do dia operacional da saída (usados na auditoria).
    const diaDaSaida = this.diaOperacionalUTC(realizadoEm);
    const saidaAntecipada = diaDaSaida.getTime() < reserva.checkOut.getTime();
    const diasAposSaidaPrevista = this.diasEntre(diaDaSaida, reserva.checkOut);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Rechecagem dentro da transação: a unique `reservaId` é a garantia final.
        const jaExiste = await tx.checkOut.findUnique({
          where: { reservaId: reserva.id },
          select: { id: true },
        });
        if (jaExiste) {
          throw new ConflictException(
            'Check-out já realizado para esta reserva',
          );
        }

        const atual = await tx.reserva.findUnique({
          where: { id: reserva.id },
          select: { status: true },
        });
        if (!atual) throw new NotFoundException('Reserva não encontrada');
        if (atual.status === StatusReserva.CANCELADA) {
          throw new BadRequestException(
            'Reserva cancelada — não é possível realizar check-out',
          );
        }
        const statusAnterior = atual.status;
        // Transição real só quando o status muda: se já era FINALIZADA o
        // `update` é pulado (evita mexer em `atualizadoEm` sem mudança) e o log
        // não pode afirmar um "novo status" que não houve.
        const statusAlterado = statusAnterior !== StatusReserva.FINALIZADA;

        const checkout = await tx.checkOut.create({
          data: {
            reservaId: reserva.id,
            realizadoEm,
            responsavelId: userId,
            observacoes,
          },
          select: { id: true },
        });

        // Se a reserva já estava FINALIZADA (pagamento reconhecido), não há o
        // que mudar: atualizar só mexeria em `atualizadoEm` sem mudança real.
        if (statusAlterado) {
          await tx.reserva.update({
            where: { id: reserva.id },
            data: { status: StatusReserva.FINALIZADA },
          });
        }

        // Auditoria atômica com o check-out (mesma transação).
        await tx.logAuditoria.create({
          data: {
            usuarioId: userId,
            acao: 'CHECKOUT_REALIZADO',
            entidade: 'Reserva',
            entidadeId: reserva.id,
            enderecoIp: enderecoIp ?? null,
            dadosNovos: {
              checkoutId: checkout.id,
              realizadoEm: realizadoEm.toISOString(),
              observacoes,
              statusAnterior,
              // `statusNovo` só existe quando houve transição (`statusAlterado`);
              // com a reserva já FINALIZADA o campo é omitido de propósito.
              ...(statusAlterado
                ? { statusNovo: StatusReserva.FINALIZADA }
                : {}),
              saidaAntecipada,
              diasAposSaidaPrevista,
            },
          },
        });
      });
    } catch (error) {
      // Corrida entre dois POST: constraint `CheckOut.reservaId` → 409 (não 500).
      // A única unique de `CheckOut` é `reserva_id` (1:1 com a reserva), então um
      // P2002 neste `create` é sempre duplicidade de check-out — inclusive quando
      // o driver não informa `meta.target` (alvo indeterminado). A checagem por
      // alvo continua quando ele vem preenchido, para não mascarar um P2002 de
      // outra origem (ex.: e-mail único de `Usuario`).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const alvo = JSON.stringify(error.meta?.target ?? null).toLowerCase();
        const alvoIndeterminado =
          alvo === 'null' || alvo === '[]' || alvo === '""';
        if (alvoIndeterminado || alvo.includes('reserva')) {
          throw new ConflictException(
            'Check-out já realizado para esta reserva',
          );
        }
      }
      throw error;
    }

    const reservaAtualizada = await this.prisma.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
      include: INCLUDE_DETALHE,
    });

    return {
      reserva: this.mapearReservaDetalhe(reservaAtualizada),
      checkin: this.mapearCheckinDetalhe(reservaAtualizada.checkin),
      checkout: this.mapearRegistro(reservaAtualizada.checkout),
    };
  }

  // ---------------------------------------------------------------------------
  // Escopo / posse (o JWT não carrega estabelecimento: tudo resolvido no banco)
  // ---------------------------------------------------------------------------

  private async resolverEscopo(
    userId: string,
    perfil: string,
  ): Promise<EscopoEstabelecimento> {
    if (perfil === PerfilUsuario.ADMIN) {
      return { admin: true, idsPermitidos: null };
    }

    // Sub-usuário: o vínculo vem do cadastro do Usuário, não do token.
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { estabelecimentoVinculadoId: true },
    });

    const vinculos: Prisma.EstabelecimentoWhereInput[] = [
      { proprietarioId: userId },
    ];
    if (usuario?.estabelecimentoVinculadoId) {
      vinculos.push({ id: usuario.estabelecimentoVinculadoId });
    }

    const estabelecimentos = await this.prisma.estabelecimento.findMany({
      where: { OR: vinculos },
      select: { id: true },
    });

    return {
      admin: false,
      idsPermitidos: estabelecimentos.map(
        (estabelecimento) => estabelecimento.id,
      ),
    };
  }

  /**
   * `estabelecimentoId` da query NUNCA amplia o escopo: para ESTABELECIMENTO ele
   * só estreita e, se estiver fora do escopo apurado, a resposta é 403.
   */
  private resolverIdsDaConsulta(
    estabelecimentoId: string | undefined,
    escopo: EscopoEstabelecimento,
  ): string[] | null {
    if (escopo.admin) {
      return estabelecimentoId ? [estabelecimentoId] : null;
    }

    const permitidos = escopo.idsPermitidos ?? [];
    if (estabelecimentoId) {
      if (!permitidos.includes(estabelecimentoId)) {
        throw new ForbiddenException(
          'Sem permissão para acessar os check-outs deste estabelecimento',
        );
      }
      return [estabelecimentoId];
    }
    return permitidos;
  }

  private assertPosse(
    estabelecimentoId: string,
    escopo: EscopoEstabelecimento,
    mensagem: string,
  ): void {
    if (escopo.admin) return;
    if (!(escopo.idsPermitidos ?? []).includes(estabelecimentoId)) {
      throw new ForbiddenException(mensagem);
    }
  }

  // ---------------------------------------------------------------------------
  // Filtros e datas operacionais
  // ---------------------------------------------------------------------------

  private montarWhereLista(
    base: Prisma.ReservaWhereInput,
    query: ListCheckoutsQueryDto,
    hoje: Date,
  ): Prisma.ReservaWhereInput {
    const filtros: Prisma.ReservaWhereInput[] = [base];

    switch (query.situacao) {
      case 'EM_ANDAMENTO':
        filtros.push({
          checkin: { isNot: null },
          checkout: { is: null },
          status: { not: StatusReserva.CANCELADA },
        });
        break;
      case 'SAIDAS_HOJE':
        filtros.push({
          checkin: { isNot: null },
          checkout: { is: null },
          status: { not: StatusReserva.CANCELADA },
          checkOut: hoje,
        });
        break;
      case 'ATRASADOS':
        filtros.push({
          checkin: { isNot: null },
          checkout: { is: null },
          status: { not: StatusReserva.CANCELADA },
          checkOut: { lt: hoje },
        });
        break;
      case 'REALIZADOS':
        filtros.push({ checkout: { isNot: null } });
        break;
      default:
        // Central operacional: hospedagem em andamento (com check-in) ou já
        // encerrada (com check-out) — o resto não pertence a esta tela.
        filtros.push({
          OR: [{ checkin: { isNot: null } }, { checkout: { isNot: null } }],
        });
        break;
    }

    if (query.data) {
      const dia = this.dataUTC(query.data);
      // `realizadoEm` é Timestamptz: a janela do dia local vai de 03:00Z a 03:00Z.
      const { inicio, fim } = this.janelaDiaOperacional(dia);
      // Dia da saída prevista OU dia em que o check-out foi realizado.
      filtros.push({
        OR: [
          { checkOut: dia },
          { checkout: { realizadoEm: { gte: inicio, lt: fim } } },
        ],
      });
    } else if (query.de || query.ate) {
      const intervalo: Prisma.DateTimeFilter = {};
      if (query.de) intervalo.gte = this.dataUTC(query.de);
      if (query.ate) intervalo.lte = this.dataUTC(query.ate);
      filtros.push({ checkOut: intervalo });
    }

    if (query.busca) {
      const termo = { contains: query.busca, mode: 'insensitive' as const };
      filtros.push({
        OR: [
          { codigoReserva: termo },
          { hospede: { nome: termo } },
          { quarto: { nome: termo } },
        ],
      });
    }

    return { AND: filtros };
  }

  /**
   * "Hoje" = dia corrente em America/Fortaleza convertido para meia-noite UTC,
   * para a virada do dia não depender do fuso do servidor.
   */
  private hojeUTC(): Date {
    return this.diaOperacionalUTC(new Date());
  }

  private diaOperacionalUTC(data: Date): Date {
    const iso = new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO_OPERACIONAL,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(data); // YYYY-MM-DD
    return new Date(`${iso}T00:00:00.000Z`);
  }

  /** `YYYY-MM-DD` → meia-noite UTC (colunas `@db.Date` do Prisma). */
  private dataUTC(valor: string): Date {
    return new Date(`${valor}T00:00:00.000Z`);
  }

  /**
   * Janela de um dia operacional (Fortaleza, UTC-3) para comparação com
   * `Timestamptz`: `diaUTC` é meia-noite UTC do dia local, então a janela real
   * começa às 03:00Z e termina às 03:00Z do dia seguinte.
   */
  private janelaDiaOperacional(diaUTC: Date): { inicio: Date; fim: Date } {
    const inicio = new Date(diaUTC.getTime() + DESLOCAMENTO_FUSO_MS);
    return { inicio, fim: new Date(inicio.getTime() + DIA_MS) };
  }

  /**
   * Dia de referência da conferência de saída: com check-out registrado vale o
   * dia operacional em que ele foi realizado (histórico não "envelhece"); sem
   * check-out, vale hoje (é o dia em que a recepção está encerrando a estadia).
   */
  private resolverDiaReferencia(
    reserva: { checkout: { realizadoEm: Date } | null },
    hoje: Date,
  ): Date {
    return reserva.checkout
      ? this.diaOperacionalUTC(reserva.checkout.realizadoEm)
      : hoje;
  }

  /** `a - b` em dias inteiros (negativo quando `a` é anterior a `b`). */
  private diasEntre(a: Date, b: Date): number {
    return Math.round((a.getTime() - b.getTime()) / DIA_MS);
  }

  private formatarData(data: Date): string {
    const [ano, mes, dia] = data.toISOString().slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  }

  private textoOuNulo(valor?: string | null): string | null {
    const texto = valor?.trim();
    return texto ? texto : null;
  }

  /**
   * `realizadoEm` do body: valida ISO, tolerância de 5 min para o futuro (relógio
   * do operador) e nunca antes do check-in. Sem body, o servidor carimba agora.
   */
  private resolverRealizadoEm(
    valor: string | undefined,
    reserva: ReservaPreCheckOut,
  ): Date {
    const agora = new Date();
    if (!valor) return agora;

    const realizadoEm = new Date(valor);
    if (Number.isNaN(realizadoEm.getTime())) {
      throw new BadRequestException('Data e hora do check-out inválida');
    }
    if (realizadoEm.getTime() > agora.getTime() + TOLERANCIA_FUTURO_MS) {
      throw new BadRequestException(
        'A data e hora do check-out não pode estar no futuro',
      );
    }
    // A pré-checagem garante `checkin` aqui; o fallback é só para o type-safety.
    const checkinEm = reserva.checkin?.realizadoEm;
    if (checkinEm && realizadoEm.getTime() < checkinEm.getTime()) {
      throw new BadRequestException(
        'A data e hora do check-out não pode ser anterior ao check-in',
      );
    }
    return realizadoEm;
  }

  // ---------------------------------------------------------------------------
  // Regras derivadas (situação, elegibilidade, financeiro, avisos)
  // ---------------------------------------------------------------------------

  private calcularSituacao(
    reserva: {
      checkOut: Date;
      checkout: { id: string } | null;
    },
    hoje: Date,
  ): SituacaoCheckout {
    if (reserva.checkout) return 'REALIZADO';
    if (reserva.checkOut.getTime() < hoje.getTime()) return 'ATRASADO';
    if (reserva.checkOut.getTime() === hoje.getTime()) return 'SAIDA_HOJE';
    return 'HOSPEDADO';
  }

  /**
   * Precedência determinística da inelegibilidade:
   * RESERVA_CANCELADA → CHECKIN_NAO_REALIZADO → CHECKOUT_JA_REALIZADO.
   *
   * Não há bloqueio por data: saída antecipada e saída depois da prevista são
   * permitidas (viram aviso no detalhe), e pagamento pendente também não bloqueia.
   */
  private calcularElegibilidade(reserva: {
    status: StatusReserva;
    checkin: { id: string } | null;
    checkout: { id: string } | null;
  }): ResultadoElegibilidade {
    if (reserva.status === StatusReserva.CANCELADA) {
      return {
        elegivel: false,
        motivo: 'Reserva cancelada — não é possível realizar check-out',
        codigo: 'RESERVA_CANCELADA',
      };
    }
    if (!reserva.checkin) {
      return {
        elegivel: false,
        motivo:
          'A hospedagem ainda não realizou check-in — registre o check-in antes do check-out',
        codigo: 'CHECKIN_NAO_REALIZADO',
      };
    }
    if (reserva.checkout) {
      return {
        elegivel: false,
        motivo: 'Check-out já realizado para esta hospedagem',
        codigo: 'CHECKOUT_JA_REALIZADO',
      };
    }
    return { elegivel: true, motivo: null, codigo: null };
  }

  /**
   * Conferência financeira derivada (somente leitura): nenhuma escrita em
   * `Pagamento`, nenhuma cobrança. O check-out nunca depende disso.
   */
  private calcularFinanceiro(reserva: ReservaDetalhe) {
    const valorTotal = Number(reserva.valorTotal);
    const valorPago =
      reserva.pagamento?.status === STATUS_PAGAMENTO_CONFIRMADO
        ? Number(reserva.pagamento.valor)
        : 0;
    // Arredonda para centavos: nada de float acumulado na borda.
    const saldoEmAberto = Math.max(
      0,
      Math.round((valorTotal - valorPago) * 100) / 100,
    );

    return {
      valorTotal,
      valorPago,
      saldoEmAberto,
      pagamento: this.mapearPagamento(reserva.pagamento),
    };
  }

  private calcularAvisos(
    reserva: ReservaDetalhe,
    diaReferencia: Date,
    financeiro: { saldoEmAberto: number },
  ): AvisoCheckOut[] {
    const avisos: AvisoCheckOut[] = [];

    if (
      !reserva.pagamento ||
      reserva.pagamento.status !== STATUS_PAGAMENTO_CONFIRMADO
    ) {
      avisos.push({
        codigo: 'PAGAMENTO_PENDENTE',
        mensagem:
          'Pagamento ainda não confirmado. O check-out pode ser realizado e o pagamento regularizado depois.',
      });
    }

    if (financeiro.saldoEmAberto > 0) {
      avisos.push({
        codigo: 'SALDO_EM_ABERTO',
        mensagem: `Há ${this.formatarMoeda(financeiro.saldoEmAberto)} em aberto. O check-out pode ser concluído; a regularização é feita no financeiro.`,
      });
    }

    // Antecipação/posterioridade só fazem sentido com estadia iniciada: com
    // check-out (histórico) ou com check-in (encerramento em curso). Reserva sem
    // check-in é inelegível e não recebe esses avisos.
    const temEstadiaIniciada = Boolean(reserva.checkin || reserva.checkout);
    if (
      temEstadiaIniciada &&
      diaReferencia.getTime() < reserva.checkOut.getTime()
    ) {
      avisos.push({
        codigo: 'SAIDA_ANTECIPADA',
        mensagem: `Saída antecipada: a saída prevista é ${this.formatarData(reserva.checkOut)}.`,
      });
    }
    if (
      temEstadiaIniciada &&
      diaReferencia.getTime() > reserva.checkOut.getTime()
    ) {
      avisos.push({
        codigo: 'SAIDA_APOS_PREVISTO',
        mensagem: `Saída após a data prevista (${this.formatarData(reserva.checkOut)}).`,
      });
    }

    return avisos;
  }

  /**
   * Próxima reserva ativa no mesmo quarto depois desta saída — insumo para a
   * recepção organizar a limpeza. A disponibilidade continua derivada das datas.
   */
  private async montarAcomodacao(reserva: ReservaDetalhe) {
    const proximaEntrada = await this.prisma.reserva.findFirst({
      where: {
        quartoId: reserva.quartoId,
        checkIn: { gt: reserva.checkOut },
        status: { not: StatusReserva.CANCELADA },
      },
      orderBy: { checkIn: 'asc' },
      select: {
        id: true,
        codigoReserva: true,
        checkIn: true,
        hospede: { select: { nome: true } },
      },
    });

    return {
      id: reserva.quarto.id,
      nome: reserva.quarto.nome,
      capacidade: reserva.quarto.capacidade,
      tipoAcomodacao: reserva.quarto.tipoAcomodacao ?? null,
      proximaEntrada: proximaEntrada
        ? {
            reservaId: proximaEntrada.id,
            codigoReserva: proximaEntrada.codigoReserva,
            checkIn: proximaEntrada.checkIn,
            hospedeNome: proximaEntrada.hospede.nome,
          }
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Mapeamento das respostas (Decimal → number, datas em ISO pelo JSON)
  // ---------------------------------------------------------------------------

  private mapearItemLista(reserva: ReservaLista, hoje: Date) {
    const elegibilidade = this.calcularElegibilidade(reserva);
    // Mesma base da auditoria: já realizado usa o dia do check-out (o número não
    // "envelhece" a cada dia); em andamento usa hoje.
    const diaReferencia = this.resolverDiaReferencia(reserva, hoje);

    return {
      reserva: this.mapearReservaLite(reserva),
      checkin: this.mapearRegistro(reserva.checkin),
      checkout: this.mapearRegistro(reserva.checkout),
      situacaoCheckout: this.calcularSituacao(reserva, hoje),
      elegivel: elegibilidade.elegivel,
      motivoInelegibilidade: elegibilidade.motivo,
      codigoInelegibilidade: elegibilidade.codigo,
      // Negativo = saída prevista no futuro; 0 = hoje; positivo = atraso em dias.
      diasAposSaidaPrevista: this.diasEntre(diaReferencia, reserva.checkOut),
      saidaAntecipada: this.calcularSaidaAntecipada(reserva, diaReferencia),
    };
  }

  /** Saída antes do previsto só existe quando há check-out e ele foi antecipado. */
  private calcularSaidaAntecipada(
    reserva: { checkOut: Date; checkout: { realizadoEm: Date } | null },
    diaReferencia: Date,
  ): boolean {
    if (!reserva.checkout) return false;
    return diaReferencia.getTime() < reserva.checkOut.getTime();
  }

  private mapearRegistro(registro: RegistroOperacao | null) {
    if (!registro) return null;
    return {
      id: registro.id,
      realizadoEm: registro.realizadoEm,
      observacoes: registro.observacoes,
      responsavel: registro.responsavel
        ? { id: registro.responsavel.id, nome: registro.responsavel.nome }
        : null,
    };
  }

  private mapearCheckinDetalhe(checkin: ReservaDetalhe['checkin']) {
    if (!checkin) return null;
    return {
      id: checkin.id,
      realizadoEm: checkin.realizadoEm,
      observacoes: checkin.observacoes,
      responsavel: checkin.responsavel
        ? { id: checkin.responsavel.id, nome: checkin.responsavel.nome }
        : null,
      hospedes: checkin.hospedes.map((hospede) => ({
        id: hospede.id,
        principal: hospede.principal,
        nome: hospede.nome,
        cpf: hospede.cpf,
        documento: hospede.documento,
        dataNascimento: hospede.dataNascimento,
        telefone: hospede.telefone,
        parentesco: hospede.parentesco,
        presente: hospede.presente,
        observacoes: hospede.observacoes,
      })),
    };
  }

  private mapearReservaLite(reserva: ReservaLista) {
    return {
      id: reserva.id,
      codigoReserva: reserva.codigoReserva,
      checkIn: reserva.checkIn,
      checkOut: reserva.checkOut,
      adultos: reserva.adultos,
      criancas: reserva.criancas,
      valorTotal: Number(reserva.valorTotal),
      status: reserva.status,
      modoPagamento: reserva.modoPagamento,
      observacoes: reserva.observacoes,
      criadoEm: reserva.criadoEm,
      hospede: {
        id: reserva.hospede.id,
        nome: reserva.hospede.nome,
        email: reserva.hospede.email,
        telefone: reserva.hospede.telefone,
      },
      quarto: {
        id: reserva.quarto.id,
        nome: reserva.quarto.nome,
        capacidade: reserva.quarto.capacidade,
      },
      pagamento: this.mapearPagamento(reserva.pagamento),
    };
  }

  private mapearReservaDetalhe(reserva: ReservaDetalhe) {
    return {
      ...this.mapearReservaLite(reserva),
      hospede: {
        id: reserva.hospede.id,
        nome: reserva.hospede.nome,
        email: reserva.hospede.email,
        telefone: reserva.hospede.telefone,
        // Renomeado para o contrato do frontend (o include do Prisma se chama `hospede`).
        hospedePerfil: reserva.hospede.hospede ?? null,
      },
      quarto: {
        id: reserva.quarto.id,
        nome: reserva.quarto.nome,
        capacidade: reserva.quarto.capacidade,
        tipoAcomodacao: reserva.quarto.tipoAcomodacao ?? null,
      },
      estabelecimento: {
        id: reserva.estabelecimento.id,
        nome: reserva.estabelecimento.nome,
      },
    };
  }

  private mapearPagamento(pagamento: ReservaLista['pagamento']) {
    if (!pagamento) return null;
    // Decimal → number na borda (convenção do projeto).
    return { ...pagamento, valor: Number(pagamento.valor) };
  }

  private respostaVazia(page: number, limit: number) {
    return {
      data: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      resumo: {
        emAndamento: 0,
        saidasHoje: 0,
        atrasados: 0,
        realizadosHoje: 0,
      },
    };
  }
}
