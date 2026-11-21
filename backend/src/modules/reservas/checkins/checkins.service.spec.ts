/**
 * Testes unitários do CheckinsService (central de check-in do estabelecimento).
 *
 * Estratégia:
 * - `PrismaService` 100% mockado: nenhum banco é tocado, nenhum `DATABASE_URL` é lido.
 * - Tempo congelado com fake timers; o "hoje" operacional é 20/11/2026 em
 *   America/Fortaleza (UTC-3), então `hojeUTC()` devolve 2026-11-20T00:00:00.000Z.
 * - As asserções seguem o CÓDIGO REAL (`checkins.service.ts`), não o plano.
 *
 * Contrato que o service já incorpora (ver `montarWhereLista`/`resumo`):
 * ATRASADOS e TODOS recortam a janela operacional com `checkOut: { gte: hoje }`,
 * ou seja, estadia já encerrada não polui a fila; `situacaoCheckIn` continua
 * derivando ATRASADO só por data.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PerfilUsuario, Prisma, StatusReserva } from '@prisma/client';
import { CheckinsService } from './checkins.service';
import { CreateCheckInDto, ListCheckinsQueryDto } from './dto/checkin.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';
const HOSPEDE_ID = '33333333-3333-4333-8333-333333333333';
const ESTAB_ID = '44444444-4444-4444-8444-444444444444';
const OUTRO_ESTAB_ID = '55555555-5555-4555-8555-555555555555';
const VINCULO_ESTAB_ID = '66666666-6666-4666-8666-666666666666';
const RESERVA_ID = '77777777-7777-4777-8777-777777777777';
const QUARTO_ID = '88888888-8888-4888-8888-888888888888';
const CHECKIN_ID = '99999999-9999-4999-8999-999999999999';
const TIPO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAGAMENTO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Meia-noite UTC — colunas `@db.Date` do Prisma. */
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** 20/11/2026 12:00 em America/Fortaleza. */
const AGORA_ISO = '2026-11-20T15:00:00.000Z';
const HOJE = dia('2026-11-20');

/** America/Fortaleza é UTC-3 fixo (sem horário de verão). */
const DESLOCAMENTO_FUSO_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Janela real de um dia operacional para colunas `Timestamptz`: o dia local
 * (00:00–24:00 em Fortaleza) equivale a 03:00Z do dia → 03:00Z do dia seguinte.
 * Espelha `janelaDiaOperacional` do service.
 */
function janelaDiaOperacional(iso: string) {
  const inicio = new Date(dia(iso).getTime() + DESLOCAMENTO_FUSO_MS);
  return { inicio, fim: new Date(inicio.getTime() + DIA_MS) };
}

/** `true` se o instante ISO cair em `[gte, lt)` da janela. */
function contemNaJanela(
  filtro: { gte: Date; lt: Date },
  instante: string,
): boolean {
  const momento = new Date(instante).getTime();
  return filtro.gte.getTime() <= momento && momento < filtro.lt.getTime();
}

const PERFIL_ESTAB = PerfilUsuario.ESTABELECIMENTO;
const PERFIL_ADMIN = PerfilUsuario.ADMIN;

/** Mesma lista de `STATUS_PERMITIDOS` do service (ordem importa nas asserções). */
const STATUS_PERMITIDOS = [
  StatusReserva.CONFIRMADA,
  StatusReserva.AGUARDANDO_PAGAMENTO,
  StatusReserva.FINALIZADA,
];

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  reserva: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  estabelecimento: { findMany: jest.fn(), findUnique: jest.fn() },
  usuario: { findUnique: jest.fn() },
  checkIn: { findUnique: jest.fn(), create: jest.fn() },
  logAuditoria: { create: jest.fn() },
  hospede: { findUnique: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(),
};

/** Cliente transacional recebido pelo callback de `$transaction`. */
const tx = {
  checkIn: { findUnique: jest.fn(), create: jest.fn() },
  logAuditoria: { create: jest.fn() },
  usuario: { update: jest.fn() },
  hospede: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Builders de fixture (campos espelham os `include` do service)
// ---------------------------------------------------------------------------

function pagamento(overrides: Record<string, unknown> = {}) {
  return {
    id: PAGAMENTO_ID,
    reservaId: RESERVA_ID,
    codigoTransacao: 'MP-123',
    metodo: 'PIX',
    comprovanteUrl: null,
    comprovanteS3Key: null,
    valor: new Prisma.Decimal('331.50'),
    status: 'PENDENTE',
    dadosPagamento: null,
    criadoEm: dia('2026-11-18'),
    atualizadoEm: dia('2026-11-18'),
    ...overrides,
  };
}

/** Payload de `INCLUDE_LISTA`. */
function reservaLista(overrides: Record<string, unknown> = {}) {
  return {
    id: RESERVA_ID,
    codigoReserva: 'HRN1234567',
    hospedeId: HOSPEDE_ID,
    estabelecimentoId: ESTAB_ID,
    quartoId: QUARTO_ID,
    checkIn: HOJE,
    checkOut: dia('2026-11-22'),
    adultos: 1,
    criancas: 0,
    valorTotal: new Prisma.Decimal('331.50'),
    status: StatusReserva.CONFIRMADA,
    modoPagamento: 'PADRAO',
    observacoes: null,
    cancelamentoMotivo: null,
    criadoEm: dia('2026-11-01'),
    atualizadoEm: dia('2026-11-01'),
    hospede: {
      id: HOSPEDE_ID,
      nome: 'Maria de Souza',
      email: 'maria@example.com',
      telefone: '(84) 99999-8888',
    },
    quarto: { id: QUARTO_ID, nome: 'Suíte Mar', capacidade: 3 },
    pagamento: null,
    checkin: null,
    ...overrides,
  };
}

/** Payload de `INCLUDE_DETALHE` (lista + perfil cadastral + estabelecimento). */
function reservaDetalhe(overrides: Record<string, unknown> = {}) {
  return {
    ...reservaLista(),
    hospede: {
      id: HOSPEDE_ID,
      nome: 'Maria de Souza',
      email: 'maria@example.com',
      telefone: '(84) 99999-8888',
      hospede: {
        cpf: '123.456.789-09',
        rg: '1234567',
        dataNascimento: dia('1995-10-25'),
        nacionalidade: 'Brasileira',
        contatoEmergencia: null,
        endereco: null,
      },
    },
    quarto: {
      id: QUARTO_ID,
      nome: 'Suíte Mar',
      capacidade: 3,
      tipoAcomodacao: { id: TIPO_ID, nome: 'Suíte' },
    },
    estabelecimento: { id: ESTAB_ID, nome: 'Pousada Teste' },
    ...overrides,
  };
}

function checkinResumo(overrides: Record<string, unknown> = {}) {
  return {
    id: CHECKIN_ID,
    realizadoEm: new Date(AGORA_ISO),
    observacoes: null,
    responsavel: { id: USUARIO_ID, nome: 'Recepção' },
    ...overrides,
  };
}

function checkinDetalhe(overrides: Record<string, unknown> = {}) {
  return {
    ...checkinResumo(),
    observacoes: 'Chegou às 14h',
    hospedes: [
      {
        id: 'hospede-checkin-1',
        checkInId: CHECKIN_ID,
        principal: true,
        nome: 'Maria de Souza',
        cpf: '123.456.789-09',
        documento: null,
        dataNascimento: dia('1995-10-25'),
        telefone: null,
        parentesco: null,
        presente: true,
        observacoes: null,
        criadoEm: dia('2026-11-20'),
      },
    ],
    ...overrides,
  };
}

/** Payload de `INCLUDE_PRE_CHECKIN` usado pela validação do POST. */
function reservaPreCheckIn(overrides: Record<string, unknown> = {}) {
  return {
    id: RESERVA_ID,
    codigoReserva: 'HRN1234567',
    hospedeId: HOSPEDE_ID,
    estabelecimentoId: ESTAB_ID,
    quartoId: QUARTO_ID,
    checkIn: HOJE,
    checkOut: dia('2026-11-22'),
    adultos: 1,
    criancas: 0,
    valorTotal: new Prisma.Decimal('331.50'),
    status: StatusReserva.CONFIRMADA,
    modoPagamento: 'PADRAO',
    observacoes: null,
    criadoEm: dia('2026-11-01'),
    atualizadoEm: dia('2026-11-01'),
    hospede: {
      id: HOSPEDE_ID,
      nome: 'Maria de Souza',
      telefone: '(84) 99999-8888',
      hospede: {
        cpf: '123.456.789-09',
        rg: '1234567',
        dataNascimento: dia('1995-10-25'),
      },
    },
    checkin: null,
    ...overrides,
  };
}

describe('CheckinsService', () => {
  let service: CheckinsService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(AGORA_ISO));

    mockPrisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: unknown) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    );

    // Defaults otimistas: escopo do dono, transação limpa e contadores zerados.
    mockPrisma.usuario.findUnique.mockResolvedValue({
      estabelecimentoVinculadoId: null,
    });
    mockPrisma.estabelecimento.findMany.mockResolvedValue([{ id: ESTAB_ID }]);
    mockPrisma.reserva.findMany.mockResolvedValue([]);
    mockPrisma.reserva.count.mockResolvedValue(0);
    tx.checkIn.findUnique.mockResolvedValue(null);
    tx.checkIn.create.mockResolvedValue({ id: CHECKIN_ID });
    tx.logAuditoria.create.mockResolvedValue({ id: 'log-1' });
    tx.usuario.update.mockResolvedValue({});
    tx.hospede.findUnique.mockResolvedValue(null);
    tx.hospede.findFirst.mockResolvedValue(null);
    tx.hospede.update.mockResolvedValue({});
    tx.hospede.create.mockResolvedValue({ id: 'hospede-criado' });

    service = new CheckinsService(mockPrisma as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Helpers de cenário
  // -------------------------------------------------------------------------

  /** Configura a reserva do POST e a reserva recarregada após a transação. */
  function prepararPost(reserva: Record<string, unknown> = {}) {
    mockPrisma.reserva.findUnique.mockResolvedValueOnce(
      reservaPreCheckIn(reserva),
    );
    mockPrisma.reserva.findUniqueOrThrow.mockResolvedValueOnce(
      reservaDetalhe({ checkin: checkinDetalhe() }),
    );
  }

  function postar(
    dto: Partial<CreateCheckInDto> = {},
    perfil: PerfilUsuario = PERFIL_ESTAB,
    userId = USUARIO_ID,
    enderecoIp?: string,
  ) {
    return service.create(
      { reservaId: RESERVA_ID, ...dto } as CreateCheckInDto,
      userId,
      perfil,
      enderecoIp,
    );
  }

  /** POST bem-sucedido com `hospedePrincipal` (fluxo de complemento cadastral). */
  async function postarComCadastro(
    dados: CreateCheckInDto['hospedePrincipal'],
  ) {
    prepararPost();
    return postar({ hospedePrincipal: dados });
  }

  function listaDe(reservas: Record<string, unknown>[], query = {}) {
    mockPrisma.reserva.findMany.mockResolvedValueOnce(reservas);
    return service.list(
      query as ListCheckinsQueryDto,
      USUARIO_ID,
      PERFIL_ESTAB,
    );
  }

  function whereDaLista() {
    return mockPrisma.reserva.findMany.mock.calls[0][0].where;
  }

  function detalharComoAdmin(reserva: Record<string, unknown>) {
    mockPrisma.reserva.findUnique.mockResolvedValueOnce(reserva);
    return service.detail(RESERVA_ID, USUARIO_ID, PERFIL_ADMIN);
  }

  // =========================================================================
  // 1. Escopo e posse (segurança/IDOR)
  // =========================================================================

  describe('escopo e posse da central (list)', () => {
    it('resolve o escopo do ESTABELECIMENTO proprietário e filtra as reservas por ele', async () => {
      await service.list({} as ListCheckinsQueryDto, USUARIO_ID, PERFIL_ESTAB);

      expect(mockPrisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { id: USUARIO_ID },
        select: { estabelecimentoVinculadoId: true },
      });
      expect(mockPrisma.estabelecimento.findMany).toHaveBeenCalledWith({
        where: { OR: [{ proprietarioId: USUARIO_ID }] },
        select: { id: true },
      });
      expect(whereDaLista().AND[0]).toEqual({
        estabelecimentoId: { in: [ESTAB_ID] },
      });
    });

    it('inclui o estabelecimento vinculado quando o usuário é sub-usuário', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValueOnce({
        estabelecimentoVinculadoId: VINCULO_ESTAB_ID,
      });
      mockPrisma.estabelecimento.findMany.mockResolvedValueOnce([
        { id: ESTAB_ID },
        { id: VINCULO_ESTAB_ID },
      ]);

      await service.list({} as ListCheckinsQueryDto, USUARIO_ID, PERFIL_ESTAB);

      expect(mockPrisma.estabelecimento.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ proprietarioId: USUARIO_ID }, { id: VINCULO_ESTAB_ID }],
        },
        select: { id: true },
      });
      expect(whereDaLista().AND[0]).toEqual({
        estabelecimentoId: { in: [ESTAB_ID, VINCULO_ESTAB_ID] },
      });
    });

    it('recusa (403) estabelecimentoId de terceiro enviado na query', async () => {
      await expect(
        service.list(
          { estabelecimentoId: OUTRO_ESTAB_ID } as ListCheckinsQueryDto,
          USUARIO_ID,
          PERFIL_ESTAB,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.reserva.findMany).not.toHaveBeenCalled();
    });

    it('aceita estabelecimentoId do próprio escopo e apenas estreita a consulta', async () => {
      await service.list(
        { estabelecimentoId: ESTAB_ID } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereDaLista().AND[0]).toEqual({
        estabelecimentoId: { in: [ESTAB_ID] },
      });
    });

    it('ADMIN sem estabelecimentoId não aplica filtro de escopo', async () => {
      await service.list({} as ListCheckinsQueryDto, USUARIO_ID, PERFIL_ADMIN);

      expect(mockPrisma.usuario.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.estabelecimento.findMany).not.toHaveBeenCalled();
      expect(whereDaLista().AND[0]).toEqual({});
    });

    it('ADMIN com estabelecimentoId vê apenas o estabelecimento filtrado', async () => {
      await service.list(
        { estabelecimentoId: OUTRO_ESTAB_ID } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ADMIN,
      );

      expect(whereDaLista().AND[0]).toEqual({
        estabelecimentoId: { in: [OUTRO_ESTAB_ID] },
      });
    });

    it('escopo vazio devolve resposta zerada sem consultar reservas', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValueOnce(null);
      mockPrisma.estabelecimento.findMany.mockResolvedValueOnce([]);

      const resultado = await service.list(
        {} as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(resultado).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        resumo: {
          chegadasHoje: 0,
          pendentes: 0,
          atrasados: 0,
          realizados: 0,
        },
      });
      expect(mockPrisma.reserva.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.reserva.count).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Detalhe / pré-check-in
  // =========================================================================

  describe('detalhe / pré-check-in', () => {
    it('404 quando a reserva não existe', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.detail(RESERVA_ID, USUARIO_ID, PERFIL_ESTAB),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('403 ao detalhar reserva de outro estabelecimento', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaDetalhe({ estabelecimentoId: OUTRO_ESTAB_ID }),
      );

      await expect(
        service.detail(RESERVA_ID, USUARIO_ID, PERFIL_ESTAB),
      ).rejects.toThrow(/Sem permissão para acessar esta reserva/);
    });

    it('ADMIN detalha reserva de qualquer estabelecimento', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaDetalhe({
          estabelecimentoId: OUTRO_ESTAB_ID,
          estabelecimento: { id: OUTRO_ESTAB_ID, nome: 'Outra Pousada' },
        }),
      );

      const resultado = await service.detail(
        RESERVA_ID,
        USUARIO_ID,
        PERFIL_ADMIN,
      );

      expect(resultado.reserva.estabelecimento).toEqual({
        id: OUTRO_ESTAB_ID,
        nome: 'Outra Pousada',
      });
    });

    it('mapeia hospedePerfil, Decimal→number e o check-in realizado', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaDetalhe({
          valorTotal: new Prisma.Decimal('1500.25'),
          pagamento: pagamento({
            valor: new Prisma.Decimal('1500.25'),
            status: 'CONFIRMADO',
          }),
          checkin: checkinDetalhe(),
        }),
      );

      const resultado = await service.detail(
        RESERVA_ID,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(resultado.reserva.valorTotal).toBe(1500.25);
      expect(resultado.reserva.pagamento?.valor).toBe(1500.25);
      expect(resultado.reserva.hospede.hospedePerfil).toMatchObject({
        cpf: '123.456.789-09',
        dataNascimento: dia('1995-10-25'),
      });
      // O include do Prisma se chama `hospede`; o contrato expõe `hospedePerfil`.
      expect(
        (resultado.reserva.hospede as Record<string, unknown>).hospede,
      ).toBeUndefined();
      expect(resultado.reserva.quarto.tipoAcomodacao).toEqual({
        id: TIPO_ID,
        nome: 'Suíte',
      });
      expect(resultado.checkin).toMatchObject({
        id: CHECKIN_ID,
        responsavel: { id: USUARIO_ID, nome: 'Recepção' },
      });
      expect(resultado.checkin?.hospedes[0]).toMatchObject({
        principal: true,
        nome: 'Maria de Souza',
        presente: true,
      });
    });
  });

  // =========================================================================
  // 3. Avisos e elegibilidade
  // =========================================================================

  describe('avisos e elegibilidade do detalhe', () => {
    it('não emite avisos quando pagamento confirmado, cadastro completo e capacidade ok', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          checkin: null,
        }),
      );

      expect(resultado.avisos).toEqual([]);
      expect(resultado.elegivel).toBe(true);
      expect(resultado.motivoInelegibilidade).toBeNull();
      expect(resultado.codigoInelegibilidade).toBeNull();
    });

    it('emite PAGAMENTO_PENDENTE quando não há pagamento, sem bloquear o check-in', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({ pagamento: null }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'PAGAMENTO_PENDENTE',
      ]);
      expect(resultado.avisos[0].mensagem).toContain(
        'Pagamento ainda não confirmado',
      );
      expect(resultado.elegivel).toBe(true);
    });

    it('emite PAGAMENTO_PENDENTE quando o pagamento existe mas não está CONFIRMADO', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({ pagamento: pagamento({ status: 'PENDENTE' }) }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'PAGAMENTO_PENDENTE',
      ]);
    });

    it('emite CADASTRO_INCOMPLETO listando CPF, data de nascimento e telefone', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          hospede: {
            id: HOSPEDE_ID,
            nome: 'Maria de Souza',
            email: 'maria@example.com',
            telefone: null,
            hospede: null,
          },
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'CADASTRO_INCOMPLETO',
      ]);
      const mensagem = resultado.avisos[0].mensagem;
      expect(mensagem).toContain('CPF');
      expect(mensagem).toContain('data de nascimento');
      expect(mensagem).toContain('telefone');
    });

    it('emite CADASTRO_INCOMPLETO só com os campos realmente faltantes', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          hospede: {
            id: HOSPEDE_ID,
            nome: 'Maria de Souza',
            email: 'maria@example.com',
            telefone: '(84) 99999-8888',
            hospede: {
              cpf: '123.456.789-09',
              rg: null,
              dataNascimento: null,
              nacionalidade: null,
              contatoEmergencia: null,
              endereco: null,
            },
          },
        }),
      );

      const mensagem = resultado.avisos[0].mensagem;
      expect(mensagem).toContain('data de nascimento');
      expect(mensagem).not.toContain('CPF');
      expect(mensagem).not.toContain('telefone');
    });

    it('emite CAPACIDADE_EXCEDIDA quando adultos + crianças superam a capacidade', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          adultos: 3,
          criancas: 1,
          quarto: {
            id: QUARTO_ID,
            nome: 'Suíte Mar',
            capacidade: 3,
            tipoAcomodacao: { id: TIPO_ID, nome: 'Suíte' },
          },
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'CAPACIDADE_EXCEDIDA',
      ]);
      expect(resultado.avisos[0].mensagem).toBe(
        'O quarto comporta 3 pessoa(s) e a reserva tem 4.',
      );
      expect(resultado.elegivel).toBe(true);
    });

    it('emite CHECKIN_ANTECIPADO quando hoje é anterior à chegada prevista', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          checkIn: dia('2026-11-21'),
          checkOut: dia('2026-11-23'),
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'CHECKIN_ANTECIPADO',
      ]);
      expect(resultado.avisos[0].mensagem).toContain('21/11/2026');
      expect(resultado.elegivel).toBe(true);
    });

    it('emite CHECKIN_ATRASADO quando hoje está entre a chegada e o check-out', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          checkIn: dia('2026-11-19'),
          checkOut: dia('2026-11-22'),
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'CHECKIN_ATRASADO',
      ]);
      expect(resultado.avisos[0].mensagem).toContain('19/11/2026');
      expect(resultado.elegivel).toBe(true);
    });

    it('precedência 1: CANCELADA vence os demais motivos e o motivo é texto pt-BR', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          status: StatusReserva.CANCELADA,
          checkin: checkinDetalhe(),
          checkIn: dia('2026-11-17'),
          checkOut: dia('2026-11-19'),
        }),
      );

      expect(resultado.elegivel).toBe(false);
      expect(resultado.codigoInelegibilidade).toBe('RESERVA_CANCELADA');
      expect(resultado.motivoInelegibilidade).toContain('cancelada');
      expect(resultado.motivoInelegibilidade).not.toBe(
        resultado.codigoInelegibilidade,
      );
    });

    it('precedência 2: STATUS_INVALIDO vence check-in já realizado e período encerrado', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          status: StatusReserva.SOLICITADA,
          checkin: checkinDetalhe(),
          checkIn: dia('2026-11-17'),
          checkOut: dia('2026-11-19'),
        }),
      );

      expect(resultado.codigoInelegibilidade).toBe('STATUS_INVALIDO');
      expect(resultado.motivoInelegibilidade).toBe(
        'Reserva ainda não foi confirmada pelo estabelecimento',
      );
    });

    it('precedência 3: CHECKIN_JA_REALIZADO vence período encerrado', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          status: StatusReserva.CONFIRMADA,
          checkin: checkinDetalhe(),
          checkIn: dia('2026-11-17'),
          checkOut: dia('2026-11-19'),
        }),
      );

      expect(resultado.codigoInelegibilidade).toBe('CHECKIN_JA_REALIZADO');
      expect(resultado.motivoInelegibilidade).toBe(
        'Check-in já realizado para esta reserva',
      );
    });

    it('precedência 4: PERIODO_ENCERRADO quando a estadia já terminou', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          status: StatusReserva.CONFIRMADA,
          checkin: null,
          checkIn: dia('2026-11-17'),
          checkOut: dia('2026-11-19'),
        }),
      );

      expect(resultado.codigoInelegibilidade).toBe('PERIODO_ENCERRADO');
      expect(resultado.motivoInelegibilidade).toContain('encerrado');
      expect(resultado.elegivel).toBe(false);
    });
  });

  // =========================================================================
  // 4. POST — regras de negócio
  // =========================================================================

  describe('POST — regras de negócio', () => {
    it('404 quando a reserva não existe, sem abrir transação', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(null);

      await expect(postar()).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('403 ao fazer check-in em reserva de outro estabelecimento, sem abrir transação', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckIn({ estabelecimentoId: OUTRO_ESTAB_ID }),
      );

      await expect(postar()).rejects.toThrow(
        /Sem permissão para realizar check-in nesta reserva/,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('409 quando já existe CheckIn para a reserva, sem abrir transação', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckIn({ checkin: { id: CHECKIN_ID } }),
      );

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 quando a reserva está SOLICITADA (ainda não confirmada)', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckIn({ status: StatusReserva.SOLICITADA }),
      );

      const tentativa = postar();

      await expect(tentativa).rejects.toBeInstanceOf(BadRequestException);
      await expect(tentativa).rejects.toThrow(/não confirmada/);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 quando a reserva está CANCELADA', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckIn({ status: StatusReserva.CANCELADA }),
      );

      await expect(postar()).rejects.toThrow(
        /Reserva cancelada — não é possível realizar check-in/,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 quando o período da estadia já foi encerrado (hoje > checkOut)', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckIn({
          checkIn: dia('2026-11-10'),
          checkOut: dia('2026-11-19'),
        }),
      );

      await expect(postar()).rejects.toThrow(
        /O período da estadia desta reserva já foi encerrado/,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      StatusReserva.CONFIRMADA,
      StatusReserva.FINALIZADA,
      StatusReserva.AGUARDANDO_PAGAMENTO,
    ])(
      'aceita check-in de reserva %s (pagamento pendente não bloqueia)',
      async (status) => {
        prepararPost({ status });

        const resultado = await postar();

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(resultado.checkin?.id).toBe(CHECKIN_ID);
        expect(resultado.reserva.id).toBe(RESERVA_ID);
      },
    );

    it('aceita check-in antecipado (hoje < checkIn)', async () => {
      prepararPost({
        checkIn: dia('2026-11-21'),
        checkOut: dia('2026-11-23'),
      });

      const resultado = await postar();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(resultado.checkin?.id).toBe(CHECKIN_ID);
    });

    it('aceita check-in atrasado (checkIn < hoje <= checkOut)', async () => {
      prepararPost({
        checkIn: dia('2026-11-19'),
        checkOut: dia('2026-11-21'),
      });

      const resultado = await postar();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(resultado.checkin?.id).toBe(CHECKIN_ID);
    });

    it('converte P2002 em CheckIn.reservaId para 409 (corrida de duplo check-in)', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckIn());
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`reserva_id`)',
          {
            code: 'P2002',
            clientVersion: '6.19.3',
            meta: { target: ['reserva_id'] },
          },
        ),
      );

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);
    });

    it('repassa P2002 de outro alvo sem mascarar como 409', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckIn());
      const erro = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: ['email'] },
        },
      );
      mockPrisma.$transaction.mockRejectedValueOnce(erro);

      await expect(postar()).rejects.toBe(erro);
    });

    it('409 quando a rechecagem dentro da transação encontra CheckIn concorrente', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckIn());
      tx.checkIn.findUnique.mockResolvedValueOnce({ id: CHECKIN_ID });

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);
      expect(tx.checkIn.create).not.toHaveBeenCalled();
      expect(tx.logAuditoria.create).not.toHaveBeenCalled();
    });

    it('grava check-in, hóspedes e auditoria na mesma transação', async () => {
      prepararPost();

      const resultado = await postar(
        {
          observacoes: '  Chegou às 14h  ',
          acompanhantes: [
            {
              nome: ' Ana Silva ',
              cpf: ' 111.222.333-44 ',
              dataNascimento: '1992-03-08',
              parentesco: 'Cônjuge',
            },
            { nome: 'João Silva', presente: false },
          ],
        },
        PERFIL_ESTAB,
        USUARIO_ID,
        '10.1.2.3',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      const dados = tx.checkIn.create.mock.calls[0][0].data;
      expect(dados).toMatchObject({
        reservaId: RESERVA_ID,
        responsavelId: USUARIO_ID,
        observacoes: 'Chegou às 14h',
        realizadoEm: new Date(AGORA_ISO),
      });

      const hospedes = dados.hospedes.create;
      expect(hospedes).toHaveLength(3);
      expect(hospedes[0]).toMatchObject({
        principal: true,
        presente: true,
        nome: 'Maria de Souza',
      });
      expect(hospedes[1]).toMatchObject({
        principal: false,
        presente: true,
        nome: 'Ana Silva',
        cpf: '111.222.333-44',
        parentesco: 'Cônjuge',
        dataNascimento: dia('1992-03-08'),
        documento: null,
        telefone: null,
        observacoes: null,
      });
      expect(hospedes[2]).toMatchObject({
        principal: false,
        presente: false,
        nome: 'João Silva',
      });

      const auditoria = tx.logAuditoria.create.mock.calls[0][0].data;
      expect(auditoria).toMatchObject({
        usuarioId: USUARIO_ID,
        acao: 'CHECKIN_REALIZADO',
        entidade: 'Reserva',
        entidadeId: RESERVA_ID,
        enderecoIp: '10.1.2.3',
      });
      expect(auditoria.dadosNovos).toMatchObject({
        checkinId: CHECKIN_ID,
        realizadoEm: AGORA_ISO,
        observacoes: 'Chegou às 14h',
      });
      expect(auditoria.dadosNovos.hospedes).toEqual([
        { nome: 'Maria de Souza', principal: true, presente: true },
        { nome: 'Ana Silva', principal: false, presente: true },
        { nome: 'João Silva', principal: false, presente: false },
      ]);
      // Sem `hospedePrincipal` nenhum campo de cadastro é aplicado.
      expect(auditoria.dadosNovos.cadastroAtualizado).toEqual([]);

      expect(Object.keys(resultado).sort()).toEqual(['checkin', 'reserva']);
      expect(resultado.checkin?.id).toBe(CHECKIN_ID);
    });

    it('registra enderecoIp nulo quando a requisição não informa IP', async () => {
      prepararPost();

      await postar();

      const auditoria = tx.logAuditoria.create.mock.calls[0][0].data;
      expect(auditoria.enderecoIp).toBeNull();
    });

    it('não cria acompanhantes quando a lista é omitida (só o principal)', async () => {
      prepararPost();

      await postar();

      const hospedes = tx.checkIn.create.mock.calls[0][0].data.hospedes.create;
      expect(hospedes).toHaveLength(1);
      expect(hospedes[0]).toMatchObject({
        principal: true,
        presente: true,
        nome: 'Maria de Souza',
      });
    });

    it('usa o perfil cadastral como fallback do hóspede principal', async () => {
      prepararPost();

      await postar();

      const principal =
        tx.checkIn.create.mock.calls[0][0].data.hospedes.create[0];
      expect(principal).toEqual({
        principal: true,
        presente: true,
        nome: 'Maria de Souza',
        cpf: '123.456.789-09',
        documento: '1234567',
        dataNascimento: dia('1995-10-25'),
        telefone: '(84) 99999-8888',
        parentesco: null,
        observacoes: null,
      });
    });

    it('prioriza os dados enviados no DTO para o hóspede principal', async () => {
      prepararPost();

      await postar({
        hospedePrincipal: {
          cpf: ' 999.888.777-66 ',
          rg: 'RG-9',
          dataNascimento: '1990-01-02',
          telefone: '84977776666',
        },
      });

      const principal =
        tx.checkIn.create.mock.calls[0][0].data.hospedes.create[0];
      expect(principal).toEqual({
        principal: true,
        presente: true,
        nome: 'Maria de Souza',
        cpf: '999.888.777-66',
        documento: 'RG-9',
        dataNascimento: dia('1990-01-02'),
        telefone: '84977776666',
        parentesco: null,
        observacoes: null,
      });
    });

    it('aceita hóspede sem perfil cadastral (campos do principal ficam nulos)', async () => {
      prepararPost({
        hospede: {
          id: HOSPEDE_ID,
          nome: 'Maria de Souza',
          telefone: null,
          hospede: null,
        },
      });

      await postar();

      const principal =
        tx.checkIn.create.mock.calls[0][0].data.hospedes.create[0];
      expect(principal).toMatchObject({
        cpf: null,
        documento: null,
        dataNascimento: null,
        telefone: null,
      });
    });
  });

  // =========================================================================
  // 5. POST — complemento do cadastro do hóspede principal
  // =========================================================================

  describe('POST — cadastro do hóspede principal (atualizarCadastroHospede)', () => {
    it('atualiza Hospede existente só com os campos enviados', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce({
        usuarioId: HOSPEDE_ID,
        cpf: '111.111.111-11',
        rg: null,
        nacionalidade: null,
        dataNascimento: dia('1995-10-25'),
      });

      await postarComCadastro({ rg: 'MG-123456' });

      expect(tx.hospede.update).toHaveBeenCalledTimes(1);
      const chamada = tx.hospede.update.mock.calls[0][0];
      expect(chamada).toEqual({
        where: { usuarioId: HOSPEDE_ID },
        data: { rg: 'MG-123456' },
      });
      // Auditoria registra só os NOMES dos campos aplicados (sem PII).
      expect(
        tx.logAuditoria.create.mock.calls[0][0].data.dadosNovos
          .cadastroAtualizado,
      ).toEqual(['rg']);
    });

    it('atualiza todos os campos enviados quando o CPF é livre', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce({
        usuarioId: HOSPEDE_ID,
        cpf: '111.111.111-11',
        rg: null,
        nacionalidade: null,
        dataNascimento: dia('1995-10-25'),
      });

      await postarComCadastro({
        cpf: '222.222.222-22',
        rg: 'MG-9',
        nacionalidade: 'Argentina',
        dataNascimento: '1990-01-02',
      });

      expect(tx.hospede.update).toHaveBeenCalledWith({
        where: { usuarioId: HOSPEDE_ID },
        data: {
          cpf: '222.222.222-22',
          rg: 'MG-9',
          nacionalidade: 'Argentina',
          dataNascimento: dia('1990-01-02'),
        },
      });
      expect(
        tx.logAuditoria.create.mock.calls[0][0].data.dadosNovos
          .cadastroAtualizado,
      ).toEqual(['cpf', 'rg', 'nacionalidade', 'dataNascimento']);
    });

    it('não sobrescreve CPF que já pertence a outro cadastro', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce({
        usuarioId: HOSPEDE_ID,
        cpf: '111.111.111-11',
        rg: null,
        nacionalidade: null,
        dataNascimento: dia('1995-10-25'),
      });
      tx.hospede.findFirst.mockResolvedValueOnce({ id: 'de-outro-usuario' });

      await postarComCadastro({ cpf: '222.222.222-22', rg: 'MG-9' });

      expect(tx.hospede.findFirst).toHaveBeenCalledWith({
        where: { cpf: '222.222.222-22', usuarioId: { not: HOSPEDE_ID } },
        select: { id: true },
      });
      expect(tx.hospede.update).toHaveBeenCalledWith({
        where: { usuarioId: HOSPEDE_ID },
        data: { rg: 'MG-9' },
      });
      // O CPF recusado não entra na lista de campos aplicados.
      expect(
        tx.logAuditoria.create.mock.calls[0][0].data.dadosNovos
          .cadastroAtualizado,
      ).toEqual(['rg']);
    });

    it('não atualiza nada quando o único campo enviado é um CPF já usado por outro', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce({
        usuarioId: HOSPEDE_ID,
        cpf: '111.111.111-11',
        rg: null,
        nacionalidade: null,
        dataNascimento: dia('1995-10-25'),
      });
      tx.hospede.findFirst.mockResolvedValueOnce({ id: 'de-outro-usuario' });

      await postarComCadastro({ cpf: '222.222.222-22' });

      expect(tx.hospede.update).not.toHaveBeenCalled();
    });

    it('cria Hospede quando não existe e recebe CPF e data de nascimento', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce(null);

      await postarComCadastro({
        cpf: '222.222.222-22',
        dataNascimento: '1990-01-02',
        rg: 'MG-9',
        nacionalidade: 'Brasileira',
      });

      expect(tx.hospede.create).toHaveBeenCalledWith({
        data: {
          usuarioId: HOSPEDE_ID,
          cpf: '222.222.222-22',
          dataNascimento: dia('1990-01-02'),
          rg: 'MG-9',
          nacionalidade: 'Brasileira',
        },
      });
      expect(
        tx.logAuditoria.create.mock.calls[0][0].data.dadosNovos
          .cadastroAtualizado,
      ).toEqual(['cpf', 'dataNascimento', 'rg', 'nacionalidade']);
    });

    it('não cria Hospede sem data de nascimento, mas conclui o check-in', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce(null);

      const resultado = await postarComCadastro({ cpf: '222.222.222-22' });

      expect(tx.hospede.create).not.toHaveBeenCalled();
      expect(tx.hospede.findFirst).not.toHaveBeenCalled();
      expect(resultado.checkin?.id).toBe(CHECKIN_ID);
    });

    it('não cria Hospede sem CPF, mas conclui o check-in', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce(null);

      const resultado = await postarComCadastro({
        dataNascimento: '1990-01-02',
      });

      expect(tx.hospede.create).not.toHaveBeenCalled();
      expect(resultado.checkin?.id).toBe(CHECKIN_ID);
    });

    it('não cria Hospede quando o CPF já pertence a outro cadastro', async () => {
      tx.hospede.findUnique.mockResolvedValueOnce(null);
      tx.hospede.findFirst.mockResolvedValueOnce({ id: 'de-outro-usuario' });

      await postarComCadastro({
        cpf: '222.222.222-22',
        dataNascimento: '1990-01-02',
      });

      expect(tx.hospede.create).not.toHaveBeenCalled();
    });

    it('atualiza o telefone no Usuário do hóspede (não no responsável)', async () => {
      await postarComCadastro({ telefone: '84988887777' });

      expect(tx.usuario.update).toHaveBeenCalledWith({
        where: { id: HOSPEDE_ID },
        data: { telefone: '84988887777' },
      });
      expect(
        tx.logAuditoria.create.mock.calls[0][0].data.dadosNovos
          .cadastroAtualizado,
      ).toEqual(['telefone']);
    });

    it('não atualiza o telefone quando o campo não é enviado', async () => {
      await postarComCadastro({ cpf: '222.222.222-22', rg: 'MG-9' });

      expect(tx.usuario.update).not.toHaveBeenCalled();
      // Sem `dataNascimento` o Hospede não nasce e nada é aplicado no cadastro.
      expect(
        tx.logAuditoria.create.mock.calls[0][0].data.dadosNovos
          .cadastroAtualizado,
      ).toEqual([]);
    });

    it('não atualiza o telefone quando o campo vem em branco', async () => {
      await postarComCadastro({ telefone: '   ' });

      expect(tx.usuario.update).not.toHaveBeenCalled();
    });

    it('não toca no cadastro do hóspede quando hospedePrincipal não é enviado', async () => {
      prepararPost();

      await postar();

      expect(tx.usuario.update).not.toHaveBeenCalled();
      expect(tx.hospede.findUnique).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. Lista — situação, dias e fuso
  // =========================================================================

  describe('lista de itens — situação, dias para chegada e fuso', () => {
    it('calcula diasParaChegada positivo e PENDENTE para chegada futura', async () => {
      const resultado = await listaDe([
        reservaLista({
          checkIn: dia('2026-11-23'),
          checkOut: dia('2026-11-25'),
        }),
      ]);

      const item = resultado.data[0];
      expect(item.diasParaChegada).toBe(3);
      expect(item.situacaoCheckIn).toBe('PENDENTE');
      expect(item.checkInAntecipado).toBe(true);
      expect(item.elegivel).toBe(true);
      expect(item.motivoInelegibilidade).toBeNull();
    });

    it('calcula diasParaChegada zero na chegada de hoje', async () => {
      const resultado = await listaDe([reservaLista()]);

      const item = resultado.data[0];
      expect(item.diasParaChegada).toBe(0);
      expect(item.situacaoCheckIn).toBe('PENDENTE');
      expect(item.checkInAntecipado).toBe(false);
    });

    it('calcula diasParaChegada negativo e ATRASADO dentro do período', async () => {
      const resultado = await listaDe([
        reservaLista({
          checkIn: dia('2026-11-19'),
          checkOut: dia('2026-11-25'),
        }),
      ]);

      const item = resultado.data[0];
      expect(item.diasParaChegada).toBe(-1);
      expect(item.situacaoCheckIn).toBe('ATRASADO');
      expect(item.elegivel).toBe(true);
    });

    it('deriva REALIZADO quando já existe check-in', async () => {
      const resultado = await listaDe([
        reservaLista({ checkin: checkinResumo() }),
      ]);

      const item = resultado.data[0];
      expect(item.situacaoCheckIn).toBe('REALIZADO');
      expect(item.checkin).toMatchObject({
        id: CHECKIN_ID,
        responsavel: { id: USUARIO_ID, nome: 'Recepção' },
      });
      expect(item.elegivel).toBe(false);
      expect(item.codigoInelegibilidade).toBe('CHECKIN_JA_REALIZADO');
    });

    it('marca checkInAntecipado quando o check-in foi feito antes da chegada prevista', async () => {
      const resultado = await listaDe([
        reservaLista({
          checkIn: dia('2026-11-21'),
          checkOut: dia('2026-11-23'),
          checkin: checkinResumo({
            realizadoEm: new Date('2026-11-20T15:00:00.000Z'),
          }),
        }),
      ]);

      expect(resultado.data[0].checkInAntecipado).toBe(true);
    });

    it('não marca checkInAntecipado quando o check-in foi no próprio dia da chegada', async () => {
      const resultado = await listaDe([
        reservaLista({ checkin: checkinResumo() }),
      ]);

      expect(resultado.data[0].checkInAntecipado).toBe(false);
    });

    it('usa o dia de America/Fortaleza, não o dia UTC (virada às 23h local)', async () => {
      // 21/11 02:30Z = 20/11 23:30 em Fortaleza → o dia operacional ainda é 20/11.
      jest.setSystemTime(new Date('2026-11-21T02:30:00.000Z'));

      const resultado = await listaDe([
        reservaLista({
          checkIn: HOJE,
          checkOut: dia('2026-11-22'),
        }),
      ]);

      const item = resultado.data[0];
      expect(item.diasParaChegada).toBe(0);
      expect(item.situacaoCheckIn).toBe('PENDENTE');
    });

    it('usa o dia anterior de Fortaleza no início da madrugada UTC', async () => {
      // 20/11 01:00Z = 19/11 22:00 em Fortaleza → o dia operacional é 19/11.
      jest.setSystemTime(new Date('2026-11-20T01:00:00.000Z'));

      const resultado = await listaDe([
        reservaLista({
          checkIn: HOJE,
          checkOut: dia('2026-11-22'),
        }),
      ]);

      expect(resultado.data[0].diasParaChegada).toBe(1);
      expect(resultado.data[0].situacaoCheckIn).toBe('PENDENTE');
    });

    it('mapeia valorTotal e valor do pagamento de Decimal para number', async () => {
      const resultado = await listaDe([
        reservaLista({
          valorTotal: new Prisma.Decimal('1500.25'),
          pagamento: pagamento({ valor: new Prisma.Decimal('1500.25') }),
        }),
      ]);

      const item = resultado.data[0];
      expect(item.reserva.valorTotal).toBe(1500.25);
      expect(item.reserva.pagamento?.valor).toBe(1500.25);
      expect(item.checkin).toBeNull();
    });

    it('aplica paginação (skip/take) e calcula totalPages', async () => {
      mockPrisma.reserva.count.mockResolvedValueOnce(25);

      const resultado = await listaDe([], { page: 3, limit: 10 });

      const argumentos = mockPrisma.reserva.findMany.mock.calls[0][0];
      expect(argumentos.skip).toBe(20);
      expect(argumentos.take).toBe(10);
      expect(resultado.page).toBe(3);
      expect(resultado.limit).toBe(10);
      expect(resultado.total).toBe(25);
      expect(resultado.totalPages).toBe(3);
    });

    it('faz clamp defensivo de page/limit fora da faixa', async () => {
      const resultado = await service.list(
        { page: 0, limit: 1000 } as unknown as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      const argumentos = mockPrisma.reserva.findMany.mock.calls[0][0];
      expect(argumentos.skip).toBe(0);
      expect(argumentos.take).toBe(100);
      expect(resultado.page).toBe(1);
      expect(resultado.limit).toBe(100);
    });
  });

  // =========================================================================
  // 7. Lista — filtros e resumo
  // =========================================================================

  describe('lista — filtros e resumo', () => {
    it('situacao=TODOS inclui reservas elegíveis vigentes ou com check-in', async () => {
      await service.list(
        { situacao: 'TODOS' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereDaLista().AND[1]).toEqual({
        OR: [
          {
            status: { in: STATUS_PERMITIDOS },
            checkOut: { gte: HOJE },
          },
          { checkin: { isNot: null } },
        ],
      });
    });

    it('situacao=PENDENTES filtra chegadas de hoje em diante sem check-in', async () => {
      await service.list(
        { situacao: 'PENDENTES' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereDaLista().AND[1]).toEqual({
        checkin: { is: null },
        checkIn: { gte: HOJE },
        status: { in: STATUS_PERMITIDOS },
      });
    });

    it('situacao=ATRASADOS recorta a janela operacional (checkOut >= hoje)', async () => {
      await service.list(
        { situacao: 'ATRASADOS' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereDaLista().AND[1]).toEqual({
        checkin: { is: null },
        checkIn: { lt: HOJE },
        checkOut: { gte: HOJE },
        status: { in: STATUS_PERMITIDOS },
      });
    });

    it('situacao=REALIZADOS filtra apenas reservas com check-in e ordena pelo realizadoEm', async () => {
      await service.list(
        { situacao: 'REALIZADOS' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereDaLista().AND[1]).toEqual({ checkin: { isNot: null } });
      expect(mockPrisma.reserva.findMany.mock.calls[0][0].orderBy).toEqual([
        { checkin: { realizadoEm: 'desc' } },
        { checkIn: 'asc' },
      ]);
    });

    it('busca monta OR por código da reserva, hóspede e quarto (case-insensitive)', async () => {
      await service.list(
        { busca: 'Maria' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      // AND[0] = escopo, AND[1] = filtro de situação (TODOS implícito), AND[2] = busca.
      expect(whereDaLista().AND[2]).toEqual({
        OR: [
          { codigoReserva: { contains: 'Maria', mode: 'insensitive' } },
          { hospede: { nome: { contains: 'Maria', mode: 'insensitive' } } },
          { quarto: { nome: { contains: 'Maria', mode: 'insensitive' } } },
        ],
      });
    });

    it('data filtra chegada prevista OU check-in realizado no dia', async () => {
      await service.list(
        { data: '2026-11-20' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      // `checkIn` é `@db.Date` (meia-noite UTC); `realizadoEm` é Timestamptz e
      // usa a janela local: 20/11 00:00–24:00 em Fortaleza = 03:00Z→03:00Z.
      const { inicio, fim } = janelaDiaOperacional('2026-11-20');
      expect(inicio.toISOString()).toBe('2026-11-20T03:00:00.000Z');
      expect(fim.toISOString()).toBe('2026-11-21T03:00:00.000Z');
      expect(whereDaLista().AND[2]).toEqual({
        OR: [
          { checkIn: HOJE },
          { checkin: { realizadoEm: { gte: inicio, lt: fim } } },
        ],
      });
    });

    it('de/ate filtram o intervalo de chegada prevista', async () => {
      await service.list(
        { de: '2026-11-01', ate: '2026-11-30' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereDaLista().AND[2]).toEqual({
        checkIn: { gte: dia('2026-11-01'), lte: dia('2026-11-30') },
      });
    });

    it('calcula o resumo com 4 contagens independentes e a janela de atrasados', async () => {
      mockPrisma.reserva.count
        .mockResolvedValueOnce(4) // total da lista
        .mockResolvedValueOnce(2) // chegadasHoje
        .mockResolvedValueOnce(1) // pendentes
        .mockResolvedValueOnce(3) // atrasados
        .mockResolvedValueOnce(5); // realizados

      const resultado = await listaDe([]);

      expect(resultado.total).toBe(4);
      expect(resultado.resumo).toEqual({
        chegadasHoje: 2,
        pendentes: 1,
        atrasados: 3,
        realizados: 5,
      });
      expect(mockPrisma.reserva.count).toHaveBeenCalledTimes(5);

      const contagens = mockPrisma.reserva.count.mock.calls.map(
        (chamada) => chamada[0].where,
      );
      // whereResumo: escopo + statuses comerciais permitidos.
      expect(contagens[1].AND[0]).toMatchObject({
        estabelecimentoId: { in: [ESTAB_ID] },
        status: { in: STATUS_PERMITIDOS },
      });
      expect(contagens[1].AND[1]).toEqual({
        checkIn: HOJE,
        checkin: { is: null },
      });
      expect(contagens[2].AND[1]).toEqual({
        checkIn: { gte: HOJE },
        checkin: { is: null },
      });
      expect(contagens[3].AND[1]).toEqual({
        checkIn: { lt: HOJE },
        checkOut: { gte: HOJE },
        checkin: { is: null },
      });
      // `realizados` conta por `realizadoEm` (Timestamptz): janela local 03:00Z→03:00Z.
      const janelaHoje = janelaDiaOperacional('2026-11-20');
      expect(contagens[4].AND[1]).toEqual({
        checkin: {
          realizadoEm: { gte: janelaHoje.inicio, lt: janelaHoje.fim },
        },
      });
      expect(
        (contagens[4].AND[1] as any).checkin.realizadoEm.gte.toISOString(),
      ).toBe('2026-11-20T03:00:00.000Z');
      expect(
        (contagens[4].AND[1] as any).checkin.realizadoEm.lt.toISOString(),
      ).toBe('2026-11-21T03:00:00.000Z');
    });

    // -----------------------------------------------------------------------
    // Bordas do dia operacional (furo apontado pelo revisor: 03:00Z, não 00:00Z)
    // -----------------------------------------------------------------------

    it('data=2026-11-20 inclui check-in das 22h locais de 20/11 (2026-11-21T01:00Z)', async () => {
      await service.list(
        { data: '2026-11-20' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      const filtro = whereDaLista().AND[2].OR[1].checkin.realizadoEm;
      expect(contemNaJanela(filtro, '2026-11-21T01:00:00.000Z')).toBe(true);
    });

    it('data=2026-11-20 inclui check-in das 02h locais de 20/11 (2026-11-20T05:00Z)', async () => {
      await service.list(
        { data: '2026-11-20' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      const filtro = whereDaLista().AND[2].OR[1].checkin.realizadoEm;
      expect(contemNaJanela(filtro, '2026-11-20T05:00:00.000Z')).toBe(true);
    });

    it('data=2026-11-20 exclui check-in das 01h locais de 21/11 (2026-11-21T04:00Z)', async () => {
      await service.list(
        { data: '2026-11-20' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      const filtro = whereDaLista().AND[2].OR[1].checkin.realizadoEm;
      expect(contemNaJanela(filtro, '2026-11-21T04:00:00.000Z')).toBe(false);
    });

    it('data=2026-11-20 exclui 23:59 locais de 19/11 (2026-11-20T02:59Z)', async () => {
      await service.list(
        { data: '2026-11-20' } as ListCheckinsQueryDto,
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      const filtro = whereDaLista().AND[2].OR[1].checkin.realizadoEm;
      expect(contemNaJanela(filtro, '2026-11-20T02:59:00.000Z')).toBe(false);
    });

    it('resumo.realizados usa a mesma janela: 22h local conta, madrugada UTC anterior não', async () => {
      await listaDe([]);

      const contagens = mockPrisma.reserva.count.mock.calls.map(
        (chamada) => chamada[0].where,
      );
      const filtro = contagens[4].AND[1].checkin.realizadoEm;

      // 20/11 22:00 local (21/11 01:00Z) e 20/11 02:00 local (20/11 05:00Z).
      expect(contemNaJanela(filtro, '2026-11-21T01:00:00.000Z')).toBe(true);
      expect(contemNaJanela(filtro, '2026-11-20T05:00:00.000Z')).toBe(true);
      // 21/11 01:00 local (21/11 04:00Z) e 19/11 23:59 local (20/11 02:59Z).
      expect(contemNaJanela(filtro, '2026-11-21T04:00:00.000Z')).toBe(false);
      expect(contemNaJanela(filtro, '2026-11-20T02:59:00.000Z')).toBe(false);
    });
  });
});
