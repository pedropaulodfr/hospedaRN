import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PerfilUsuario, Prisma, StatusReserva } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateCheckInDto,
  HospedePrincipalDto,
  ListCheckinsQueryDto,
} from './dto/checkin.dto';

/** Situação exibida na central — derivada do `CheckIn`, nunca persistida. */
export type SituacaoCheckIn = 'PENDENTE' | 'ATRASADO' | 'REALIZADO';

/**
 * Status comerciais que permitem check-in. `SOLICITADA` ainda não foi
 * confirmada pelo estabelecimento e `CANCELADA` não é estadia válida.
 */
const STATUS_PERMITIDOS: StatusReserva[] = [
  StatusReserva.CONFIRMADA,
  StatusReserva.AGUARDANDO_PAGAMENTO,
  StatusReserva.FINALIZADA,
];

/** Fuso do dia operacional (RN não tem horário de verão: UTC-3 fixo). */
const FUSO_OPERACIONAL = 'America/Fortaleza';
const DIA_MS = 86_400_000;
/** 00:00 em Fortaleza (UTC-3) = 03:00Z — usado nas janelas de `Timestamptz`. */
const DESLOCAMENTO_FUSO_MS = 3 * 60 * 60 * 1000;

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
} satisfies Prisma.ReservaInclude;

/** Include do detalhe/pré-check-in: perfil cadastral, tipo de acomodação e hóspedes. */
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
} satisfies Prisma.ReservaInclude;

/** Include mínimo para validar o POST (dados do hóspede para fallback do principal). */
const INCLUDE_PRE_CHECKIN = {
  hospede: {
    select: {
      id: true,
      nome: true,
      telefone: true,
      hospede: { select: { cpf: true, rg: true, dataNascimento: true } },
    },
  },
  checkin: { select: { id: true } },
} satisfies Prisma.ReservaInclude;

type ReservaLista = Prisma.ReservaGetPayload<{ include: typeof INCLUDE_LISTA }>;
type ReservaDetalhe = Prisma.ReservaGetPayload<{
  include: typeof INCLUDE_DETALHE;
}>;
type ReservaPreCheckIn = Prisma.ReservaGetPayload<{
  include: typeof INCLUDE_PRE_CHECKIN;
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

export interface AvisoCheckIn {
  codigo: string;
  mensagem: string;
}

@Injectable()
export class CheckinsService {
  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. Central de check-ins
  // ---------------------------------------------------------------------------

  async list(query: ListCheckinsQueryDto, userId: string, perfil: string) {
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

    // Ordenação determinística: realizados pelo mais recente, o resto pela chegada.
    const orderBy: Prisma.ReservaOrderByWithRelationInput[] =
      query.situacao === 'REALIZADOS'
        ? [{ checkin: { realizadoEm: 'desc' } }, { checkIn: 'asc' }]
        : [{ checkIn: 'asc' }, { criadoEm: 'asc' }];

    const whereResumo: Prisma.ReservaWhereInput = {
      ...whereEscopo,
      status: { in: STATUS_PERMITIDOS },
    };
    // `realizadoEm` é Timestamptz: o dia operacional de Fortaleza começa às
    // 03:00Z e termina às 03:00Z do dia seguinte (check-in às 22h locais conta
    // como hoje). As colunas `@db.Date` (checkIn/checkOut) seguem em meia-noite UTC.
    const { inicio: inicioDiaOperacional, fim: fimDiaOperacional } =
      this.janelaDiaOperacional(hoje);

    const [reservas, total, chegadasHoje, pendentes, atrasados, realizados] =
      await Promise.all([
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
            AND: [whereResumo, { checkIn: hoje, checkin: { is: null } }],
          },
        }),
        this.prisma.reserva.count({
          where: {
            AND: [
              whereResumo,
              { checkIn: { gte: hoje }, checkin: { is: null } },
            ],
          },
        }),
        this.prisma.reserva.count({
          where: {
            AND: [
              whereResumo,
              {
                checkIn: { lt: hoje },
                checkOut: { gte: hoje },
                checkin: { is: null },
              },
            ],
          },
        }),
        this.prisma.reserva.count({
          where: {
            AND: [
              whereResumo,
              {
                checkin: {
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
      resumo: { chegadasHoje, pendentes, atrasados, realizados },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Detalhe / pré-check-in
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
      'Sem permissão para acessar esta reserva',
    );

    const hoje = this.hojeUTC();
    const elegibilidade = this.calcularElegibilidade(reserva, hoje);

    return {
      reserva: this.mapearReservaDetalhe(reserva),
      checkin: this.mapearCheckinDetalhe(reserva.checkin),
      elegivel: elegibilidade.elegivel,
      motivoInelegibilidade: elegibilidade.motivo,
      codigoInelegibilidade: elegibilidade.codigo,
      avisos: this.calcularAvisos(reserva, hoje),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Registro do check-in
  // ---------------------------------------------------------------------------

  async create(
    dto: CreateCheckInDto,
    userId: string,
    perfil: string,
    enderecoIp?: string,
  ) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: dto.reservaId },
      include: INCLUDE_PRE_CHECKIN,
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    const escopo = await this.resolverEscopo(userId, perfil);
    this.assertPosse(
      reserva.estabelecimentoId,
      escopo,
      'Sem permissão para realizar check-in nesta reserva',
    );

    // Checagem prévia (a corrida real é fechada pela unique de `CheckIn.reservaId`).
    if (reserva.checkin) {
      throw new ConflictException('Check-in já realizado para esta reserva');
    }

    if (reserva.status === StatusReserva.SOLICITADA) {
      throw new BadRequestException(
        'Reserva ainda não confirmada pelo estabelecimento — confirme a reserva antes do check-in',
      );
    }
    if (reserva.status === StatusReserva.CANCELADA) {
      throw new BadRequestException(
        'Reserva cancelada — não é possível realizar check-in',
      );
    }

    const hoje = this.hojeUTC();
    if (hoje.getTime() > reserva.checkOut.getTime()) {
      throw new BadRequestException(
        'O período da estadia desta reserva já foi encerrado',
      );
    }

    const acompanhantes = dto.acompanhantes ?? [];
    // O principal é sempre presente; a checagem é defensiva/explícita.
    const presentes =
      1 + acompanhantes.filter((a) => a.presente !== false).length;
    if (presentes < 1) {
      throw new BadRequestException('Informe pelo menos um hóspede presente');
    }

    const principal = this.montarHospedePrincipal(
      reserva,
      dto.hospedePrincipal,
    );
    const acompanhantesDados: Prisma.HospedeCheckInCreateWithoutCheckInInput[] =
      acompanhantes.map((acompanhante) => ({
        principal: false,
        presente: acompanhante.presente !== false,
        nome: acompanhante.nome.trim(),
        cpf: this.textoOuNulo(acompanhante.cpf),
        documento: this.textoOuNulo(acompanhante.documento),
        dataNascimento: this.dataOuNulo(acompanhante.dataNascimento),
        telefone: this.textoOuNulo(acompanhante.telefone),
        parentesco: this.textoOuNulo(acompanhante.parentesco),
        observacoes: this.textoOuNulo(acompanhante.observacoes),
      }));

    const realizadoEm = new Date();
    const observacoes = this.textoOuNulo(dto.observacoes);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Rechecagem dentro da transação: a unique `reservaId` é a garantia final.
        const jaExiste = await tx.checkIn.findUnique({
          where: { reservaId: reserva.id },
          select: { id: true },
        });
        if (jaExiste) {
          throw new ConflictException(
            'Check-in já realizado para esta reserva',
          );
        }

        const checkin = await tx.checkIn.create({
          data: {
            reservaId: reserva.id,
            realizadoEm,
            responsavelId: userId,
            observacoes,
            hospedes: { create: [principal, ...acompanhantesDados] },
          },
          select: { id: true },
        });

        // Complemento de cadastro: só os campos enviados; o restante fica no check-in.
        // Guardamos só os NOMES dos campos alterados (auditoria sem PII duplicada).
        let cadastroAtualizado: string[] = [];
        if (dto.hospedePrincipal) {
          cadastroAtualizado = await this.atualizarCadastroHospede(
            tx,
            reserva.hospede.id,
            dto.hospedePrincipal,
          );
        }

        // Auditoria atômica com o check-in (mesma transação).
        await tx.logAuditoria.create({
          data: {
            usuarioId: userId,
            acao: 'CHECKIN_REALIZADO',
            entidade: 'Reserva',
            entidadeId: reserva.id,
            enderecoIp: enderecoIp ?? null,
            dadosNovos: {
              checkinId: checkin.id,
              realizadoEm: realizadoEm.toISOString(),
              observacoes,
              cadastroAtualizado,
              hospedes: [
                { nome: principal.nome, principal: true, presente: true },
                ...acompanhantesDados.map((acompanhante) => ({
                  nome: acompanhante.nome,
                  principal: false,
                  presente: acompanhante.presente ?? true,
                })),
              ],
            },
          },
        });
      });
    } catch (error) {
      // Corrida entre dois POST: constraint `CheckIn.reservaId` → 409 (não 500).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const alvo = JSON.stringify(error.meta?.target ?? '').toLowerCase();
        if (alvo.includes('reserva')) {
          throw new ConflictException(
            'Check-in já realizado para esta reserva',
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
          'Sem permissão para acessar os check-ins deste estabelecimento',
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
    query: ListCheckinsQueryDto,
    hoje: Date,
  ): Prisma.ReservaWhereInput {
    const filtros: Prisma.ReservaWhereInput[] = [base];

    switch (query.situacao) {
      case 'PENDENTES':
        filtros.push({
          checkin: { is: null },
          checkIn: { gte: hoje },
          status: { in: STATUS_PERMITIDOS },
        });
        break;
      case 'ATRASADOS':
        // No-show/estadia em curso: atrasado E ainda dentro do período.
        filtros.push({
          checkin: { is: null },
          checkIn: { lt: hoje },
          checkOut: { gte: hoje },
          status: { in: STATUS_PERMITIDOS },
        });
        break;
      case 'REALIZADOS':
        filtros.push({ checkin: { isNot: null } });
        break;
      default:
        // Central operacional: fora `TODOS` só entram reservas que permitem
        // check-in e ainda estão vigentes, ou que já têm check-in (histórico).
        filtros.push({
          OR: [
            { status: { in: STATUS_PERMITIDOS }, checkOut: { gte: hoje } },
            { checkin: { isNot: null } },
          ],
        });
        break;
    }

    if (query.data) {
      const dia = this.dataUTC(query.data);
      // `realizadoEm` é Timestamptz: a janela do dia local vai de 03:00Z a 03:00Z.
      const { inicio, fim } = this.janelaDiaOperacional(dia);
      // Dia da chegada prevista OU dia em que o check-in foi realizado.
      filtros.push({
        OR: [
          { checkIn: dia },
          { checkin: { realizadoEm: { gte: inicio, lt: fim } } },
        ],
      });
    } else if (query.de || query.ate) {
      const intervalo: Prisma.DateTimeFilter = {};
      if (query.de) intervalo.gte = this.dataUTC(query.de);
      if (query.ate) intervalo.lte = this.dataUTC(query.ate);
      filtros.push({ checkIn: intervalo });
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

  private dataOuNulo(valor?: string | null): Date | null {
    return valor ? this.dataUTC(valor) : null;
  }

  private diasEntre(chegada: Date, hoje: Date): number {
    return Math.round((chegada.getTime() - hoje.getTime()) / DIA_MS);
  }

  private formatarData(data: Date): string {
    const [ano, mes, dia] = data.toISOString().slice(0, 10).split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private textoOuNulo(valor?: string | null): string | null {
    const texto = valor?.trim();
    return texto ? texto : null;
  }

  // ---------------------------------------------------------------------------
  // Regras derivadas (situação, elegibilidade, avisos)
  // ---------------------------------------------------------------------------

  private calcularSituacao(
    checkin: { id: string } | null,
    checkIn: Date,
    hoje: Date,
  ): SituacaoCheckIn {
    if (checkin) return 'REALIZADO';
    return hoje.getTime() <= checkIn.getTime() ? 'PENDENTE' : 'ATRASADO';
  }

  /**
   * Precedência determinística da inelegibilidade:
   * CANCELADA → STATUS_INVALIDO → CHECKIN_JA_REALIZADO → PERIODO_ENCERRADO.
   * `motivo` é texto humano (a UI exibe direto); `codigo` é o identificador
   * estável para máquina.
   */
  private calcularElegibilidade(
    reserva: {
      status: StatusReserva;
      checkIn: Date;
      checkOut: Date;
      checkin: { id: string } | null;
    },
    hoje: Date,
  ): ResultadoElegibilidade {
    if (reserva.status === StatusReserva.CANCELADA) {
      return {
        elegivel: false,
        motivo: 'Reserva cancelada — não é possível realizar check-in',
        codigo: 'RESERVA_CANCELADA',
      };
    }
    if (!STATUS_PERMITIDOS.includes(reserva.status)) {
      return {
        elegivel: false,
        motivo: 'Reserva ainda não foi confirmada pelo estabelecimento',
        codigo: 'STATUS_INVALIDO',
      };
    }
    if (reserva.checkin) {
      return {
        elegivel: false,
        motivo: 'Check-in já realizado para esta reserva',
        codigo: 'CHECKIN_JA_REALIZADO',
      };
    }
    if (hoje.getTime() > reserva.checkOut.getTime()) {
      return {
        elegivel: false,
        motivo: 'O período da estadia desta reserva já foi encerrado',
        codigo: 'PERIODO_ENCERRADO',
      };
    }
    return { elegivel: true, motivo: null, codigo: null };
  }

  private calcularAvisos(reserva: ReservaDetalhe, hoje: Date): AvisoCheckIn[] {
    const avisos: AvisoCheckIn[] = [];

    if (!reserva.pagamento || reserva.pagamento.status !== 'CONFIRMADO') {
      avisos.push({
        codigo: 'PAGAMENTO_PENDENTE',
        mensagem:
          'Pagamento ainda não confirmado. O check-in pode ser realizado e o pagamento regularizado depois.',
      });
    }

    const perfil = reserva.hospede.hospede;
    const camposFaltantes: string[] = [];
    if (!this.textoOuNulo(perfil?.cpf)) camposFaltantes.push('CPF');
    if (!perfil?.dataNascimento) camposFaltantes.push('data de nascimento');
    if (!this.textoOuNulo(reserva.hospede.telefone)) {
      camposFaltantes.push('telefone');
    }
    if (camposFaltantes.length > 0) {
      avisos.push({
        codigo: 'CADASTRO_INCOMPLETO',
        mensagem: `Cadastro do hóspede incompleto: ${camposFaltantes.join(', ')}. O check-in pode ser realizado, mas os dados podem ser completados depois.`,
      });
    }

    const pessoas = reserva.adultos + reserva.criancas;
    if (pessoas > reserva.quarto.capacidade) {
      avisos.push({
        codigo: 'CAPACIDADE_EXCEDIDA',
        mensagem: `O quarto comporta ${reserva.quarto.capacidade} pessoa(s) e a reserva tem ${pessoas}.`,
      });
    }

    if (hoje.getTime() < reserva.checkIn.getTime()) {
      avisos.push({
        codigo: 'CHECKIN_ANTECIPADO',
        mensagem: `Check-in antecipado: a chegada prevista é ${this.formatarData(reserva.checkIn)}.`,
      });
    }
    if (
      hoje.getTime() > reserva.checkIn.getTime() &&
      hoje.getTime() <= reserva.checkOut.getTime()
    ) {
      avisos.push({
        codigo: 'CHECKIN_ATRASADO',
        mensagem: `Check-in atrasado: a chegada prevista foi ${this.formatarData(reserva.checkIn)}.`,
      });
    }

    return avisos;
  }

  // ---------------------------------------------------------------------------
  // Montagem dos dados do check-in
  // ---------------------------------------------------------------------------

  private montarHospedePrincipal(
    reserva: ReservaPreCheckIn,
    dados?: HospedePrincipalDto,
  ): Prisma.HospedeCheckInCreateWithoutCheckInInput {
    const perfil = reserva.hospede.hospede;
    return {
      principal: true,
      presente: true,
      nome: reserva.hospede.nome,
      cpf: this.textoOuNulo(dados?.cpf) ?? perfil?.cpf ?? null,
      // `Hospede` não tem coluna `documento`: o valor enviado fica só no check-in.
      documento:
        this.textoOuNulo(dados?.documento) ??
        this.textoOuNulo(dados?.rg) ??
        perfil?.rg ??
        null,
      dataNascimento:
        this.dataOuNulo(dados?.dataNascimento) ??
        perfil?.dataNascimento ??
        null,
      telefone:
        this.textoOuNulo(dados?.telefone) ??
        this.textoOuNulo(reserva.hospede.telefone),
      parentesco: null,
      observacoes: null,
    };
  }

  /**
   * Atualiza o cadastro do hóspede só com os campos enviados. Se o `Hospede`
   * ainda não existir, cria apenas quando `cpf` e `dataNascimento` (NOT NULL)
   * vierem; caso contrário o check-in segue válido com os dados em
   * `HospedeCheckIn`.
   *
   * Retorna os NOMES dos campos efetivamente aplicados — a auditoria usa essa
   * lista em vez de duplicar PII no log.
   */
  private async atualizarCadastroHospede(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    dados: HospedePrincipalDto,
  ): Promise<string[]> {
    const alterados: string[] = [];

    const telefone = this.textoOuNulo(dados.telefone);
    if (telefone) {
      await tx.usuario.update({ where: { id: usuarioId }, data: { telefone } });
      alterados.push('telefone');
    }

    const cpf = this.textoOuNulo(dados.cpf);
    const rg = this.textoOuNulo(dados.rg);
    const nacionalidade = this.textoOuNulo(dados.nacionalidade);
    const dataNascimento = this.dataOuNulo(dados.dataNascimento);

    const cadastro = await tx.hospede.findUnique({ where: { usuarioId } });

    if (cadastro) {
      const atualizacao: Prisma.HospedeUpdateInput = {};
      if (cpf && cpf !== cadastro.cpf) {
        // Nunca sobrescrever CPF que já pertence a outro cadastro.
        const conflito = await tx.hospede.findFirst({
          where: { cpf, usuarioId: { not: usuarioId } },
          select: { id: true },
        });
        if (!conflito) {
          atualizacao.cpf = cpf;
          alterados.push('cpf');
        }
      }
      if (rg) {
        atualizacao.rg = rg;
        alterados.push('rg');
      }
      if (nacionalidade) {
        atualizacao.nacionalidade = nacionalidade;
        alterados.push('nacionalidade');
      }
      if (dataNascimento) {
        atualizacao.dataNascimento = dataNascimento;
        alterados.push('dataNascimento');
      }

      if (Object.keys(atualizacao).length > 0) {
        await tx.hospede.update({ where: { usuarioId }, data: atualizacao });
      }
      return alterados;
    }

    if (!cpf || !dataNascimento) return alterados;

    const cpfDeOutro = await tx.hospede.findFirst({
      where: { cpf },
      select: { id: true },
    });
    if (cpfDeOutro) return alterados;

    await tx.hospede.create({
      data: {
        usuarioId,
        cpf,
        dataNascimento,
        rg: rg ?? undefined,
        nacionalidade: nacionalidade ?? undefined,
      },
    });

    alterados.push('cpf', 'dataNascimento');
    if (rg) alterados.push('rg');
    if (nacionalidade) alterados.push('nacionalidade');
    return alterados;
  }

  // ---------------------------------------------------------------------------
  // Mapeamento das respostas (Decimal → number, datas em ISO pelo JSON)
  // ---------------------------------------------------------------------------

  private mapearItemLista(reserva: ReservaLista, hoje: Date) {
    const checkin = reserva.checkin
      ? this.mapearCheckinResumo(reserva.checkin)
      : null;
    const diasParaChegada = this.diasEntre(reserva.checkIn, hoje);
    const checkInAntecipado = checkin
      ? this.diaOperacionalUTC(checkin.realizadoEm).getTime() <
        reserva.checkIn.getTime()
      : diasParaChegada > 0;
    const elegibilidade = this.calcularElegibilidade(reserva, hoje);

    return {
      reserva: this.mapearReservaLite(reserva),
      checkin,
      situacaoCheckIn: this.calcularSituacao(
        reserva.checkin,
        reserva.checkIn,
        hoje,
      ),
      elegivel: elegibilidade.elegivel,
      motivoInelegibilidade: elegibilidade.motivo,
      codigoInelegibilidade: elegibilidade.codigo,
      checkInAntecipado,
      diasParaChegada,
    };
  }

  private mapearCheckinResumo(checkin: NonNullable<ReservaLista['checkin']>) {
    return {
      id: checkin.id,
      realizadoEm: checkin.realizadoEm,
      observacoes: checkin.observacoes,
      responsavel: checkin.responsavel
        ? { id: checkin.responsavel.id, nome: checkin.responsavel.nome }
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
      resumo: { chegadasHoje: 0, pendentes: 0, atrasados: 0, realizados: 0 },
    };
  }
}
