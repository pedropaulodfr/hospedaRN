/**
 * Testes unitários do CheckoutsService (central de check-out do estabelecimento).
 *
 * Estratégia (a mesma do `checkins.service.spec.ts`, de propósito):
 * - `PrismaService` 100% mockado: nenhum banco é tocado, nenhum `DATABASE_URL` é lido.
 * - Tempo congelado com fake timers; o "hoje" operacional é 20/11/2026 em
 *   America/Fortaleza (UTC-3), então `hojeUTC()` devolve 2026-11-20T00:00:00.000Z.
 * - As asserções seguem o CÓDIGO REAL (`checkouts.service.ts`), não o plano.
 *
 * Contrato que o service já incorpora (não é bug, é a decisão de produto):
 * - "hospedagem encerrada" é a existência do `CheckOut`; `Reserva.status`
 *   `FINALIZADA` significa pagamento reconhecido e é gravado no POST;
 * - `situacaoCheckout` é derivada (REALIZADO/ATRASADO/SAIDA_HOJE/HOSPEDADO),
 *   nunca persistida;
 * - nenhum caminho escreve em `Pagamento` nem chama `quarto.update`.
 *
 * Os mocks são tipados (`jest.Mock<Promise<unknown>, [Args]...>`) porque o
 * ESLint do projeto roda `recommendedTypeChecked` e acesso a `any` é erro.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PerfilUsuario, Prisma, StatusReserva } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma.service';
import { CheckoutsService } from './checkouts.service';
import {
  CreateCheckOutDto,
  ListCheckoutsQueryDto,
  SituacaoCheckoutFiltro,
} from './dto/checkout.dto';

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
const CHECKOUT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TIPO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAGAMENTO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROXIMA_RESERVA_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/** Meia-noite UTC — colunas `@db.Date` do Prisma. */
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** 20/11/2026 12:00 em America/Fortaleza (UTC-3). */
const AGORA_ISO = '2026-11-20T15:00:00.000Z';
const HOJE = dia('2026-11-20');
/** Check-in realizado no dia anterior ao "hoje" congelado. */
const CHECKIN_EM = new Date('2026-11-19T15:00:00.000Z');

/** America/Fortaleza é UTC-3 fixo (sem horário de verão). */
const DESLOCAMENTO_FUSO_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

const PERFIL_ESTAB = PerfilUsuario.ESTABELECIMENTO;
const PERFIL_ADMIN = PerfilUsuario.ADMIN;

/**
 * Janela real de um dia operacional para colunas `Timestamptz`: o dia local
 * (00:00–24:00 em Fortaleza) equivale a 03:00Z do dia → 03:00Z do dia seguinte.
 * Espelha `janelaDiaOperacional` do service.
 */
function janelaDiaOperacional(iso: string) {
  const inicio = new Date(dia(iso).getTime() + DESLOCAMENTO_FUSO_MS);
  return { inicio, fim: new Date(inicio.getTime() + DIA_MS) };
}

interface Janela {
  gte: Date;
  lt: Date;
}

/** `true` se o instante ISO cair em `[gte, lt)` da janela. */
function contemNaJanela(filtro: Janela, instante: string): boolean {
  const momento = new Date(instante).getTime();
  return filtro.gte.getTime() <= momento && momento < filtro.lt.getTime();
}

// ---------------------------------------------------------------------------
// Mocks tipados
// ---------------------------------------------------------------------------

interface ArgsFindMany {
  where: { AND: unknown[] };
  skip: number;
  take: number;
  orderBy: unknown;
  include: unknown;
}

interface ArgsCount {
  where: { AND: unknown[] };
}

interface ArgsCheckOutCreate {
  data: {
    reservaId: string;
    realizadoEm: Date;
    responsavelId: string;
    observacoes: string | null;
  };
}

interface ArgsLogAuditoria {
  data: {
    usuarioId: string;
    acao: string;
    entidade: string;
    entidadeId: string;
    enderecoIp: string | null;
    dadosNovos: {
      checkoutId: string;
      realizadoEm: string;
      observacoes: string | null;
      statusAnterior: string;
      // Omitido de propósito quando a reserva já estava FINALIZADA: não houve
      // transição de status, então a auditoria não pode afirmar uma.
      statusNovo?: string;
      saidaAntecipada: boolean;
      diasAposSaidaPrevista: number;
    };
  };
}

const mockPrisma = {
  reserva: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    findUniqueOrThrow: jest.fn<Promise<unknown>, [unknown]>(),
    findMany: jest.fn<Promise<unknown>, [ArgsFindMany]>(),
    count: jest.fn<Promise<unknown>, [ArgsCount]>(),
    findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
  },
  estabelecimento: { findMany: jest.fn<Promise<unknown>, [unknown]>() },
  usuario: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
  // Presentes de propósito: os testes provam que NADA é escrito aqui.
  checkOut: { create: jest.fn<Promise<unknown>, [unknown]>() },
  pagamento: {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>(),
    upsert: jest.fn<Promise<unknown>, [unknown]>(),
  },
  quarto: {
    update: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>(),
  },
  $transaction: jest.fn<Promise<unknown>, [unknown]>(),
};

/** Cliente transacional recebido pelo callback de `$transaction`. */
const tx = {
  checkOut: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    create: jest.fn<Promise<unknown>, [ArgsCheckOutCreate]>(),
  },
  reserva: {
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
  },
  logAuditoria: { create: jest.fn<Promise<unknown>, [ArgsLogAuditoria]>() },
  // Também presentes para provar ausência de escrita.
  pagamento: { update: jest.fn<Promise<unknown>, [unknown]>() },
  quarto: { update: jest.fn<Promise<unknown>, [unknown]>() },
};

/** Primeira chamada de um mock tipado (os argumentos já vêm tipados). */
function primeiro<A>(mock: jest.Mock<Promise<unknown>, [A]>): A {
  return mock.mock.calls[0][0];
}

/** Leitura tipada de um valor que o mock devolve como `unknown`. */
function ler<T>(valor: unknown): T {
  return valor as T;
}

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
    checkout: null,
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
    realizadoEm: CHECKIN_EM,
    observacoes: null,
    responsavel: { id: USUARIO_ID, nome: 'Recepção' },
    ...overrides,
  };
}

/** Payload de `INCLUDE_DETALHE.checkin` — inclui a lista de hóspedes. */
function checkinDetalhe(overrides: Record<string, unknown> = {}) {
  return { ...checkinResumo(), hospedes: [], ...overrides };
}

function checkoutResumo(overrides: Record<string, unknown> = {}) {
  return {
    id: CHECKOUT_ID,
    realizadoEm: new Date(AGORA_ISO),
    observacoes: null,
    responsavel: { id: USUARIO_ID, nome: 'Recepção' },
    ...overrides,
  };
}

/** Payload de `INCLUDE_PRE` usado pelas pré-checagens do POST. */
function reservaPreCheckout(overrides: Record<string, unknown> = {}) {
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
    checkin: { id: CHECKIN_ID, realizadoEm: CHECKIN_EM },
    checkout: null,
    ...overrides,
  };
}

describe('CheckoutsService', () => {
  let service: CheckoutsService;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(AGORA_ISO));

    // `$transaction` só é usado com callback no service real.
    mockPrisma.$transaction.mockImplementation((arg: unknown) =>
      (arg as (client: unknown) => Promise<unknown>)(tx),
    );

    // Defaults otimistas: escopo do dono, transação limpa e contadores zerados.
    mockPrisma.usuario.findUnique.mockResolvedValue({
      estabelecimentoVinculadoId: null,
    });
    mockPrisma.estabelecimento.findMany.mockResolvedValue([{ id: ESTAB_ID }]);
    mockPrisma.reserva.findMany.mockResolvedValue([]);
    mockPrisma.reserva.count.mockResolvedValue(0);
    mockPrisma.reserva.findFirst.mockResolvedValue(null);
    tx.checkOut.findUnique.mockResolvedValue(null);
    tx.checkOut.create.mockResolvedValue({ id: CHECKOUT_ID });
    tx.reserva.findUnique.mockResolvedValue({
      status: StatusReserva.CONFIRMADA,
    });
    tx.reserva.update.mockResolvedValue({});
    tx.logAuditoria.create.mockResolvedValue({ id: 'log-1' });

    service = new CheckoutsService(mockPrisma as unknown as PrismaService);
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
      reservaPreCheckout(reserva),
    );
    mockPrisma.reserva.findUniqueOrThrow.mockResolvedValueOnce(
      reservaDetalhe({ checkin: checkinDetalhe(), checkout: checkoutResumo() }),
    );
  }

  function postar(
    dto: Partial<CreateCheckOutDto> = {},
    perfil: PerfilUsuario = PERFIL_ESTAB,
    userId = USUARIO_ID,
    enderecoIp?: string,
  ) {
    return service.create(
      { reservaId: RESERVA_ID, ...dto },
      userId,
      perfil,
      enderecoIp,
    );
  }

  function listaDe(reservas: unknown[], query: ListCheckoutsQueryDto = {}) {
    mockPrisma.reserva.findMany.mockResolvedValueOnce(reservas);
    return service.list(query, USUARIO_ID, PERFIL_ESTAB);
  }

  function whereLista(): { AND: unknown[] } {
    return primeiro(mockPrisma.reserva.findMany).where;
  }

  function whereDoCount(indice: number): { AND: unknown[] } {
    return mockPrisma.reserva.count.mock.calls[indice][0].where;
  }

  function detalharComoAdmin(reserva: unknown) {
    mockPrisma.reserva.findUnique.mockResolvedValueOnce(reserva);
    return service.detail(RESERVA_ID, USUARIO_ID, PERFIL_ADMIN);
  }

  // =========================================================================
  // 1. Escopo e posse (segurança/IDOR)
  // =========================================================================

  describe('escopo e posse da central (list)', () => {
    it('resolve o escopo do ESTABELECIMENTO proprietário e filtra as reservas por ele', async () => {
      await service.list({}, USUARIO_ID, PERFIL_ESTAB);

      expect(mockPrisma.usuario.findUnique).toHaveBeenCalledWith({
        where: { id: USUARIO_ID },
        select: { estabelecimentoVinculadoId: true },
      });
      expect(mockPrisma.estabelecimento.findMany).toHaveBeenCalledWith({
        where: { OR: [{ proprietarioId: USUARIO_ID }] },
        select: { id: true },
      });
      expect(whereLista().AND[0]).toEqual({
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

      await service.list({}, USUARIO_ID, PERFIL_ESTAB);

      expect(mockPrisma.estabelecimento.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ proprietarioId: USUARIO_ID }, { id: VINCULO_ESTAB_ID }],
        },
        select: { id: true },
      });
      expect(whereLista().AND[0]).toEqual({
        estabelecimentoId: { in: [ESTAB_ID, VINCULO_ESTAB_ID] },
      });
    });

    it('recusa (403) estabelecimentoId de terceiro enviado na query', async () => {
      await expect(
        service.list(
          { estabelecimentoId: OUTRO_ESTAB_ID },
          USUARIO_ID,
          PERFIL_ESTAB,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mockPrisma.reserva.findMany).not.toHaveBeenCalled();
    });

    it('aceita estabelecimentoId do próprio escopo e apenas estreita a consulta', async () => {
      await service.list(
        { estabelecimentoId: ESTAB_ID },
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereLista().AND[0]).toEqual({
        estabelecimentoId: { in: [ESTAB_ID] },
      });
    });

    it('ADMIN sem estabelecimentoId não aplica filtro de escopo', async () => {
      await service.list({}, USUARIO_ID, PERFIL_ADMIN);

      expect(mockPrisma.usuario.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.estabelecimento.findMany).not.toHaveBeenCalled();
      expect(whereLista().AND[0]).toEqual({});
    });

    it('ADMIN com estabelecimentoId vê apenas o estabelecimento filtrado', async () => {
      await service.list(
        { estabelecimentoId: OUTRO_ESTAB_ID },
        USUARIO_ID,
        PERFIL_ADMIN,
      );

      expect(whereLista().AND[0]).toEqual({
        estabelecimentoId: { in: [OUTRO_ESTAB_ID] },
      });
    });

    it('escopo vazio devolve resposta zerada sem consultar reservas', async () => {
      mockPrisma.usuario.findUnique.mockResolvedValueOnce(null);
      mockPrisma.estabelecimento.findMany.mockResolvedValueOnce([]);

      const resultado = await service.list({}, USUARIO_ID, PERFIL_ESTAB);

      expect(resultado).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        resumo: {
          emAndamento: 0,
          saidasHoje: 0,
          atrasados: 0,
          realizadosHoje: 0,
        },
      });
      expect(mockPrisma.reserva.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.reserva.count).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Lista — as 5 combinações de situação
  // =========================================================================

  describe('lista — filtro de situação', () => {
    const CASOS: [SituacaoCheckoutFiltro, Record<string, unknown>][] = [
      [
        'EM_ANDAMENTO',
        {
          checkin: { isNot: null },
          checkout: { is: null },
          status: { not: StatusReserva.CANCELADA },
        },
      ],
      [
        'SAIDAS_HOJE',
        {
          checkin: { isNot: null },
          checkout: { is: null },
          status: { not: StatusReserva.CANCELADA },
          checkOut: HOJE,
        },
      ],
      [
        'ATRASADOS',
        {
          checkin: { isNot: null },
          checkout: { is: null },
          status: { not: StatusReserva.CANCELADA },
          checkOut: { lt: HOJE },
        },
      ],
      ['REALIZADOS', { checkout: { isNot: null } }],
      [
        'TODOS',
        {
          OR: [{ checkin: { isNot: null } }, { checkout: { isNot: null } }],
        },
      ],
    ];

    for (const [situacao, filtro] of CASOS) {
      it(`situacao=${situacao} aplica o filtro esperado em AND[1]`, async () => {
        await service.list({ situacao }, USUARIO_ID, PERFIL_ESTAB);

        expect(whereLista().AND[1]).toEqual(filtro);
      });
    }
  });

  // =========================================================================
  // 3. Lista — data, intervalo e busca
  // =========================================================================

  describe('lista — filtros de data e busca', () => {
    it('data filtra saída prevista OU dia do check-out realizado (janela 03:00Z–03:00Z)', async () => {
      await service.list({ data: '2026-11-20' }, USUARIO_ID, PERFIL_ESTAB);

      // `checkOut` é `@db.Date` (meia-noite UTC); `realizadoEm` é Timestamptz e
      // usa a janela local: 20/11 00:00–24:00 em Fortaleza = 03:00Z→03:00Z.
      const { inicio, fim } = janelaDiaOperacional('2026-11-20');
      expect(inicio.toISOString()).toBe('2026-11-20T03:00:00.000Z');
      expect(fim.toISOString()).toBe('2026-11-21T03:00:00.000Z');
      expect(whereLista().AND[2]).toEqual({
        OR: [
          { checkOut: HOJE },
          { checkout: { realizadoEm: { gte: inicio, lt: fim } } },
        ],
      });
    });

    it('data=2026-11-20 inclui check-out das 22h locais (2026-11-21T01:00Z)', async () => {
      await service.list({ data: '2026-11-20' }, USUARIO_ID, PERFIL_ESTAB);

      const filtro = ler<{ checkout: { realizadoEm: Janela } }>(
        ler<{ OR: [unknown, unknown] }>(whereLista().AND[2]).OR[1],
      );
      expect(
        contemNaJanela(filtro.checkout.realizadoEm, '2026-11-21T01:00:00.000Z'),
      ).toBe(true);
    });

    it('de/ate filtram o intervalo de checkOut de forma inclusiva', async () => {
      await service.list(
        { de: '2026-11-01', ate: '2026-11-30' },
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereLista().AND[2]).toEqual({
        checkOut: { gte: dia('2026-11-01'), lte: dia('2026-11-30') },
      });
    });

    it('ate sozinho limita apenas o teto do intervalo', async () => {
      await service.list({ ate: '2026-11-30' }, USUARIO_ID, PERFIL_ESTAB);

      expect(whereLista().AND[2]).toEqual({
        checkOut: { lte: dia('2026-11-30') },
      });
    });

    it('busca monta OR por código da reserva, hóspede e quarto (case-insensitive)', async () => {
      await service.list({ busca: 'Maria' }, USUARIO_ID, PERFIL_ESTAB);

      // AND[0] = escopo, AND[1] = situação (TODOS implícito), AND[2] = busca.
      expect(whereLista().AND[2]).toEqual({
        OR: [
          { codigoReserva: { contains: 'Maria', mode: 'insensitive' } },
          { hospede: { nome: { contains: 'Maria', mode: 'insensitive' } } },
          { quarto: { nome: { contains: 'Maria', mode: 'insensitive' } } },
        ],
      });
    });

    it('acumula situação + data + busca na ordem dos ANDs', async () => {
      await service.list(
        { situacao: 'REALIZADOS', data: '2026-11-20', busca: 'Maria' },
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(whereLista().AND).toHaveLength(4);
      expect(whereLista().AND[1]).toEqual({ checkout: { isNot: null } });
    });
  });

  // =========================================================================
  // 4. Lista — ordenação, paginação e resumo
  // =========================================================================

  describe('lista — ordenação, paginação e resumo', () => {
    it('REALIZADOS ordena pelo check-out mais recente', async () => {
      await service.list({ situacao: 'REALIZADOS' }, USUARIO_ID, PERFIL_ESTAB);

      expect(primeiro(mockPrisma.reserva.findMany).orderBy).toEqual([
        { checkout: { realizadoEm: 'desc' } },
      ]);
    });

    it('as demais situações ordenam por saída prevista e criação', async () => {
      await service.list({ situacao: 'TODOS' }, USUARIO_ID, PERFIL_ESTAB);

      expect(primeiro(mockPrisma.reserva.findMany).orderBy).toEqual([
        { checkOut: 'asc' },
        { criadoEm: 'asc' },
      ]);
    });

    it('aplica paginação (skip/take) e calcula totalPages', async () => {
      mockPrisma.reserva.count.mockResolvedValueOnce(25);

      const resultado = await listaDe([], { page: 3, limit: 10 });

      expect(primeiro(mockPrisma.reserva.findMany).skip).toBe(20);
      expect(primeiro(mockPrisma.reserva.findMany).take).toBe(10);
      expect(resultado.page).toBe(3);
      expect(resultado.limit).toBe(10);
      expect(resultado.total).toBe(25);
      expect(resultado.totalPages).toBe(3);
    });

    it('faz clamp defensivo de page/limit fora da faixa', async () => {
      const resultado = await service.list(
        { page: 0, limit: 1000 },
        USUARIO_ID,
        PERFIL_ESTAB,
      );

      expect(primeiro(mockPrisma.reserva.findMany).skip).toBe(0);
      expect(primeiro(mockPrisma.reserva.findMany).take).toBe(100);
      expect(resultado.page).toBe(1);
      expect(resultado.limit).toBe(100);
    });

    it('resumo usa 4 contagens independentes sobre a base sem CANCELADA', async () => {
      mockPrisma.reserva.count
        .mockResolvedValueOnce(4) // total da lista
        .mockResolvedValueOnce(2) // emAndamento
        .mockResolvedValueOnce(1) // saidasHoje
        .mockResolvedValueOnce(3) // atrasados
        .mockResolvedValueOnce(5); // realizadosHoje

      const resultado = await listaDe([]);

      expect(resultado.total).toBe(4);
      expect(resultado.resumo).toEqual({
        emAndamento: 2,
        saidasHoje: 1,
        atrasados: 3,
        realizadosHoje: 5,
      });
      expect(mockPrisma.reserva.count).toHaveBeenCalledTimes(5);
      // `resumo` ignora busca/data/situacao: é o cabeçalho do escopo.
      expect(whereDoCount(1).AND[0]).toMatchObject({
        estabelecimentoId: { in: [ESTAB_ID] },
        status: { not: StatusReserva.CANCELADA },
      });
    });

    it('resumo recorta cada contagem na sua janela operacional', async () => {
      await listaDe([]);

      const semSaida = { checkin: { isNot: null }, checkout: { is: null } };
      expect(whereDoCount(1).AND[1]).toEqual(semSaida);
      expect(whereDoCount(2).AND[1]).toEqual({ ...semSaida, checkOut: HOJE });
      expect(whereDoCount(3).AND[1]).toEqual({
        ...semSaida,
        checkOut: { lt: HOJE },
      });

      // `realizadosHoje` conta por `realizadoEm` (Timestamptz): 03:00Z→03:00Z.
      const { inicio, fim } = janelaDiaOperacional('2026-11-20');
      expect(whereDoCount(4).AND[1]).toEqual({
        checkout: { realizadoEm: { gte: inicio, lt: fim } },
      });
    });
  });

  // =========================================================================
  // 5. Lista — mapeamento do item
  // =========================================================================

  describe('lista — mapeamento do item', () => {
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
    });

    it('deriva situacaoCheckout nos 4 estados', async () => {
      const resultado = await listaDe([
        reservaLista({ checkout: checkoutResumo() }),
        reservaLista({ checkOut: dia('2026-11-19') }),
        reservaLista({ checkOut: HOJE }),
        reservaLista({ checkOut: dia('2026-11-22') }),
      ]);

      expect(resultado.data.map((item) => item.situacaoCheckout)).toEqual([
        'REALIZADO',
        'ATRASADO',
        'SAIDA_HOJE',
        'HOSPEDADO',
      ]);
    });

    it('calcula diasAposSaidaPrevista positivo (atraso), zero (hoje) e negativo (futuro)', async () => {
      const resultado = await listaDe([
        reservaLista({ checkOut: dia('2026-11-18') }),
        reservaLista({ checkOut: HOJE }),
        reservaLista({ checkOut: dia('2026-11-23') }),
      ]);

      // `diasEntre(hoje, checkOut)` = hoje − saída prevista.
      expect(resultado.data.map((item) => item.diasAposSaidaPrevista)).toEqual([
        2, 0, -3,
      ]);
    });

    it('marca saidaAntecipada só quando o check-out foi antes da saída prevista', async () => {
      const resultado = await listaDe([
        reservaLista({
          checkOut: dia('2026-11-22'),
          checkout: checkoutResumo({
            realizadoEm: new Date('2026-11-20T15:00:00.000Z'),
          }),
        }),
        // Check-out no próprio dia previsto não é antecipado.
        reservaLista({
          checkOut: dia('2026-11-22'),
          checkout: checkoutResumo({
            realizadoEm: new Date('2026-11-22T15:00:00.000Z'),
          }),
        }),
        // Sem check-out não existe saída antecipada.
        reservaLista({ checkout: null }),
      ]);

      expect(resultado.data.map((item) => item.saidaAntecipada)).toEqual([
        true,
        false,
        false,
      ]);
    });

    it('devolve checkin e checkout nulos quando não existem', async () => {
      const resultado = await listaDe([reservaLista()]);

      expect(resultado.data[0].checkin).toBeNull();
      expect(resultado.data[0].checkout).toBeNull();
    });

    it('item já realizado usa o dia do check-out, não hoje, no diasAposSaidaPrevista', async () => {
      // "Hoje" avança 5 dias além da saída prevista: o item realizado não envelhece.
      jest.setSystemTime(new Date('2026-11-25T15:00:00.000Z'));

      const resultado = await listaDe([
        reservaLista({
          checkOut: dia('2026-11-22'),
          checkout: checkoutResumo({
            realizadoEm: new Date('2026-11-20T15:00:00.000Z'),
          }),
        }),
      ]);

      const item = resultado.data[0];
      // 20/11 − 22/11 = −2 (e não 25/11 − 22/11 = +3).
      expect(item.diasAposSaidaPrevista).toBe(-2);
      expect(item.saidaAntecipada).toBe(true);
    });

    it('item já realizado no próprio dia previsto tem 0 dia e não é antecipado', async () => {
      jest.setSystemTime(new Date('2026-11-25T15:00:00.000Z'));

      const resultado = await listaDe([
        reservaLista({
          checkOut: dia('2026-11-22'),
          checkout: checkoutResumo({
            realizadoEm: new Date('2026-11-22T15:00:00.000Z'),
          }),
        }),
      ]);

      // 22/11 − 22/11 = 0 (e não 25/11 − 22/11 = +3).
      expect(resultado.data[0].diasAposSaidaPrevista).toBe(0);
      expect(resultado.data[0].saidaAntecipada).toBe(false);
    });

    it('item em andamento (sem check-out) continua contando a partir de hoje', async () => {
      const resultado = await listaDe([
        reservaLista({
          checkin: checkinResumo(),
          checkOut: dia('2026-11-23'),
        }),
      ]);

      expect(resultado.data[0].diasAposSaidaPrevista).toBe(-3);
      expect(resultado.data[0].saidaAntecipada).toBe(false);
    });
  });

  // =========================================================================
  // 6. "Hoje" é o dia de America/Fortaleza, não o dia UTC
  // =========================================================================

  describe('dia operacional de America/Fortaleza', () => {
    it('22h local de 20/11 (2026-11-21T01:00Z) ainda é 20/11', async () => {
      jest.setSystemTime(new Date('2026-11-21T01:00:00.000Z'));

      await service.list({ situacao: 'SAIDAS_HOJE' }, USUARIO_ID, PERFIL_ESTAB);

      // Se o service usasse o dia UTC, `checkOut` seria 21/11.
      expect(whereLista().AND[1]).toEqual({
        checkin: { isNot: null },
        checkout: { is: null },
        status: { not: StatusReserva.CANCELADA },
        checkOut: dia('2026-11-20'),
      });
    });

    it('02h local de 20/11 (2026-11-20T05:00Z) é 20/11', async () => {
      jest.setSystemTime(new Date('2026-11-20T05:00:00.000Z'));

      const resultado = await listaDe([
        reservaLista({ checkOut: dia('2026-11-21') }),
      ]);

      expect(resultado.data[0].diasAposSaidaPrevista).toBe(-1);
      expect(resultado.data[0].situacaoCheckout).toBe('HOSPEDADO');
    });
  });

  // =========================================================================
  // 7. Detalhe — autorização e conferência financeira
  // =========================================================================

  describe('detalhe / conferência de saída', () => {
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
      ).rejects.toThrow(/Sem permissão para acessar esta hospedagem/);
    });

    it('ADMIN detalha reserva de qualquer estabelecimento', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          estabelecimentoId: OUTRO_ESTAB_ID,
          estabelecimento: { id: OUTRO_ESTAB_ID, nome: 'Outra Pousada' },
        }),
      );

      expect(resultado.reserva.estabelecimento).toEqual({
        id: OUTRO_ESTAB_ID,
        nome: 'Outra Pousada',
      });
    });

    it('valorPago conta só quando o pagamento está CONFIRMADO', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          valorTotal: new Prisma.Decimal('1500.25'),
          pagamento: pagamento({
            status: 'CONFIRMADO',
            valor: new Prisma.Decimal('1500.25'),
          }),
        }),
      );

      expect(resultado.financeiro).toMatchObject({
        valorTotal: 1500.25,
        valorPago: 1500.25,
        saldoEmAberto: 0,
      });
      // Conferência financeira é somente leitura.
      expect(mockPrisma.pagamento.update).not.toHaveBeenCalled();
      expect(mockPrisma.pagamento.upsert).not.toHaveBeenCalled();
    });

    it('pagamento PENDENTE não entra como pago e deixa o total em aberto', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({
            status: 'PENDENTE',
            valor: new Prisma.Decimal('100.00'),
          }),
        }),
      );

      expect(resultado.financeiro.valorPago).toBe(0);
      expect(resultado.financeiro.saldoEmAberto).toBe(331.5);
    });

    it('pagamento nulo vira null e saldo igual ao total', async () => {
      const resultado = await detalharComoAdmin(reservaDetalhe());

      expect(resultado.financeiro.pagamento).toBeNull();
      expect(resultado.financeiro.valorPago).toBe(0);
      expect(resultado.financeiro.saldoEmAberto).toBe(331.5);
    });

    it('saldoEmAberto nunca fica negativo quando o pago supera o total', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          pagamento: pagamento({
            status: 'CONFIRMADO',
            valor: new Prisma.Decimal('400.00'),
          }),
        }),
      );

      expect(resultado.financeiro.saldoEmAberto).toBe(0);
    });

    it('proximaEntrada consulta a próxima reserva ativa do mesmo quarto', async () => {
      mockPrisma.reserva.findFirst.mockResolvedValueOnce({
        id: PROXIMA_RESERVA_ID,
        codigoReserva: 'HRN9999999',
        checkIn: dia('2026-11-25'),
        hospede: { nome: 'João Silva' },
      });

      const resultado = await detalharComoAdmin(
        reservaDetalhe({ checkOut: dia('2026-11-22') }),
      );

      expect(mockPrisma.reserva.findFirst).toHaveBeenCalledWith({
        where: {
          quartoId: QUARTO_ID,
          checkIn: { gt: dia('2026-11-22') },
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
      expect(resultado.acomodacao.proximaEntrada).toEqual({
        reservaId: PROXIMA_RESERVA_ID,
        codigoReserva: 'HRN9999999',
        checkIn: dia('2026-11-25'),
        hospedeNome: 'João Silva',
      });
    });

    it('proximaEntrada é null quando não há reserva seguinte', async () => {
      const resultado = await detalharComoAdmin(reservaDetalhe());

      expect(resultado.acomodacao).toMatchObject({
        id: QUARTO_ID,
        nome: 'Suíte Mar',
        capacidade: 3,
        tipoAcomodacao: { id: TIPO_ID, nome: 'Suíte' },
      });
      expect(resultado.acomodacao.proximaEntrada).toBeNull();
    });

    it('mapeia check-in e check-out do detalhe com o responsável', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkin: checkinDetalhe({ observacoes: 'Chegou às 14h' }),
          checkout: checkoutResumo({ observacoes: 'Saiu às 10h' }),
        }),
      );

      expect(resultado.checkout).toEqual({
        id: CHECKOUT_ID,
        realizadoEm: new Date(AGORA_ISO),
        observacoes: 'Saiu às 10h',
        responsavel: { id: USUARIO_ID, nome: 'Recepção' },
      });
      expect(resultado.checkin?.id).toBe(CHECKIN_ID);
    });
  });

  // =========================================================================
  // 8. Detalhe — avisos
  // =========================================================================

  describe('detalhe — avisos (nenhum bloqueia o check-out)', () => {
    it('não emite avisos com pagamento confirmado integral e saída prevista para hoje', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: HOJE,
          checkin: checkinDetalhe(),
          pagamento: pagamento({ status: 'CONFIRMADO' }),
        }),
      );

      expect(resultado.avisos).toEqual([]);
      expect(resultado.elegivel).toBe(true);
    });

    it('emite PAGAMENTO_PENDENTE + SALDO_EM_ABERTO sem bloquear o check-out', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: HOJE,
          checkin: checkinDetalhe(),
          pagamento: null,
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'PAGAMENTO_PENDENTE',
        'SALDO_EM_ABERTO',
      ]);
      expect(resultado.avisos[0].mensagem).toContain(
        'Pagamento ainda não confirmado',
      );
      expect(resultado.elegivel).toBe(true);
    });

    it('emite SALDO_EM_ABERTO quando o pago não cobre o total', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: HOJE,
          checkin: checkinDetalhe(),
          pagamento: pagamento({
            status: 'CONFIRMADO',
            valor: new Prisma.Decimal('100.00'),
          }),
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'SALDO_EM_ABERTO',
      ]);
      expect(resultado.avisos[0].mensagem).toContain('231,50');
      expect(resultado.elegivel).toBe(true);
    });

    it('emite SAIDA_ANTECIPADA quando o check-out foi antes da saída prevista', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: dia('2026-11-22'),
          checkin: checkinDetalhe(),
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          checkout: checkoutResumo({
            realizadoEm: new Date('2026-11-20T15:00:00.000Z'),
          }),
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'SAIDA_ANTECIPADA',
      ]);
      expect(resultado.avisos[0].mensagem).toContain('22/11/2026');
      // A inelegibilidade é do check-out já feito, não do aviso.
      expect(resultado.codigoInelegibilidade).toBe('CHECKOUT_JA_REALIZADO');
    });

    it('emite SAIDA_APOS_PREVISTO quando o check-out foi depois da saída prevista', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: dia('2026-11-22'),
          checkin: checkinDetalhe(),
          pagamento: pagamento({ status: 'CONFIRMADO' }),
          checkout: checkoutResumo({
            realizadoEm: new Date('2026-11-23T15:00:00.000Z'),
          }),
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'SAIDA_APOS_PREVISTO',
      ]);
      expect(resultado.avisos[0].mensagem).toContain('22/11/2026');
      expect(resultado.codigoInelegibilidade).toBe('CHECKOUT_JA_REALIZADO');
    });

    /**
     * Fonte do dia de referência (`resolverDiaReferencia`): em andamento usa
     * hoje; já realizado usa o dia operacional do check-out. Os avisos de
     * antecipação/posterioridade só existem com estadia iniciada (check-in ou
     * check-out).
     */
    it('em estadia em andamento (check-in sem check-out) o aviso usa hoje', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: dia('2026-11-25'),
          checkin: checkinDetalhe(),
          checkout: null,
          pagamento: pagamento({ status: 'CONFIRMADO' }),
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'SAIDA_ANTECIPADA',
      ]);
      expect(resultado.elegivel).toBe(true);
    });

    it('em estadia em andamento atrasada emite SAIDA_APOS_PREVISTO sem bloquear', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: dia('2026-11-18'),
          checkin: checkinDetalhe(),
          checkout: null,
          pagamento: pagamento({ status: 'CONFIRMADO' }),
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'SAIDA_APOS_PREVISTO',
      ]);
      expect(resultado.elegivel).toBe(true);
    });

    it('sem check-in e sem check-out não emite SAIDA_ANTECIPADA (saída futura)', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: dia('2026-11-25'),
          checkin: null,
          checkout: null,
          pagamento: null,
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'PAGAMENTO_PENDENTE',
        'SALDO_EM_ABERTO',
      ]);
      expect(resultado.elegivel).toBe(false);
      expect(resultado.codigoInelegibilidade).toBe('CHECKIN_NAO_REALIZADO');
    });

    it('sem check-in e sem check-out não emite SAIDA_APOS_PREVISTO (saída passada)', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkOut: dia('2026-11-18'),
          checkin: null,
          checkout: null,
          pagamento: null,
        }),
      );

      expect(resultado.avisos.map((aviso) => aviso.codigo)).toEqual([
        'PAGAMENTO_PENDENTE',
        'SALDO_EM_ABERTO',
      ]);
      expect(resultado.elegivel).toBe(false);
      expect(resultado.codigoInelegibilidade).toBe('CHECKIN_NAO_REALIZADO');
    });
  });

  // =========================================================================
  // 9. Detalhe — elegibilidade
  // =========================================================================

  describe('detalhe — elegibilidade', () => {
    it('precedência 1: CANCELADA vence check-in e check-out, com motivo em pt-BR', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          status: StatusReserva.CANCELADA,
          checkin: checkinDetalhe(),
          checkout: checkoutResumo(),
        }),
      );

      expect(resultado.elegivel).toBe(false);
      expect(resultado.codigoInelegibilidade).toBe('RESERVA_CANCELADA');
      expect(resultado.motivoInelegibilidade).toContain('cancelada');
      // Código estável para máquina ≠ texto humano.
      expect(resultado.motivoInelegibilidade).not.toBe(
        resultado.codigoInelegibilidade,
      );
    });

    it('precedência 2: CHECKIN_NAO_REALIZADO sem check-in', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({ checkin: null }),
      );

      expect(resultado.codigoInelegibilidade).toBe('CHECKIN_NAO_REALIZADO');
      expect(resultado.motivoInelegibilidade).toContain('check-in');
      expect(resultado.elegivel).toBe(false);
    });

    it('precedência 3: CHECKOUT_JA_REALIZADO com check-in e check-out', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({
          checkin: checkinDetalhe(),
          checkout: checkoutResumo(),
        }),
      );

      expect(resultado.codigoInelegibilidade).toBe('CHECKOUT_JA_REALIZADO');
      expect(resultado.motivoInelegibilidade).toContain('já realizado');
    });

    it('o check-in ausente vence o check-out existente (idempotência)', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({ checkin: null, checkout: checkoutResumo() }),
      );

      expect(resultado.codigoInelegibilidade).toBe('CHECKIN_NAO_REALIZADO');
    });

    it('é elegível com check-in feito e sem check-out', async () => {
      const resultado = await detalharComoAdmin(
        reservaDetalhe({ checkin: checkinDetalhe(), checkout: null }),
      );

      expect(resultado.elegivel).toBe(true);
      expect(resultado.motivoInelegibilidade).toBeNull();
      expect(resultado.codigoInelegibilidade).toBeNull();
    });
  });

  // =========================================================================
  // 10. POST — pré-checagens
  // =========================================================================

  describe('POST — pré-checagens (sem abrir transação)', () => {
    it('404 quando a reserva não existe', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(null);

      await expect(postar()).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.usuario.findUnique).not.toHaveBeenCalled();
    });

    it('403 ao fazer check-out em reserva de outro estabelecimento', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckout({ estabelecimentoId: OUTRO_ESTAB_ID }),
      );

      await expect(postar()).rejects.toThrow(
        /Sem permissão para realizar check-out nesta reserva/,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('409 quando já existe CheckOut para a reserva', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckout({ checkout: { id: CHECKOUT_ID } }),
      );

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 quando a reserva está CANCELADA', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckout({ status: StatusReserva.CANCELADA }),
      );

      await expect(postar()).rejects.toThrow(
        /Reserva cancelada — não é possível realizar check-out/,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 quando a reserva não tem check-in, citando o check-in na mensagem', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckout({ checkin: null }),
      );

      await expect(postar()).rejects.toThrow(/registre o check-in/);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 11. POST — janela de realizadoEm
  // =========================================================================

  describe('POST — realizadoEm', () => {
    it('400 quando realizadoEm está mais de 5 min no futuro', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());

      await expect(
        postar({ realizadoEm: '2026-11-20T15:10:00.000Z' }),
      ).rejects.toThrow(/não pode estar no futuro/);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('aceita realizadoEm dentro da tolerância de 5 min do relógio', async () => {
      prepararPost();

      await postar({ realizadoEm: '2026-11-20T15:04:00.000Z' });

      expect(primeiro(tx.checkOut.create).data.realizadoEm).toEqual(
        new Date('2026-11-20T15:04:00.000Z'),
      );
    });

    it('400 quando realizadoEm é anterior ao check-in', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());

      await expect(
        postar({ realizadoEm: '2026-11-19T14:00:00.000Z' }),
      ).rejects.toThrow(/não pode ser anterior ao check-in/);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('usa o horário do servidor quando realizadoEm é omitido', async () => {
      prepararPost();

      await postar();

      expect(primeiro(tx.checkOut.create).data.realizadoEm).toEqual(
        new Date(AGORA_ISO),
      );
    });
  });

  // =========================================================================
  // 12. POST — transação, auditoria e efeitos
  // =========================================================================

  describe('POST — transação e auditoria', () => {
    it('grava CheckOut, status FINALIZADA e auditoria na mesma transação', async () => {
      prepararPost();

      const resultado = await postar(
        { observacoes: 'Saída às 10h' },
        PERFIL_ESTAB,
        USUARIO_ID,
        '10.1.2.3',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(primeiro(tx.checkOut.create).data).toEqual({
        reservaId: RESERVA_ID,
        realizadoEm: new Date(AGORA_ISO),
        responsavelId: USUARIO_ID,
        observacoes: 'Saída às 10h',
      });
      expect(tx.reserva.update).toHaveBeenCalledWith({
        where: { id: RESERVA_ID },
        data: { status: StatusReserva.FINALIZADA },
      });

      const auditoria = primeiro(tx.logAuditoria.create).data;
      expect(auditoria).toMatchObject({
        usuarioId: USUARIO_ID,
        acao: 'CHECKOUT_REALIZADO',
        entidade: 'Reserva',
        entidadeId: RESERVA_ID,
        enderecoIp: '10.1.2.3',
      });
      expect(auditoria.dadosNovos).toEqual({
        checkoutId: CHECKOUT_ID,
        realizadoEm: AGORA_ISO,
        observacoes: 'Saída às 10h',
        statusAnterior: StatusReserva.CONFIRMADA,
        statusNovo: 'FINALIZADA',
        saidaAntecipada: true,
        diasAposSaidaPrevista: -2,
      });

      // Nada é gravado fora da transação.
      expect(mockPrisma.checkOut.create).not.toHaveBeenCalled();
      expect(mockPrisma.reserva.update).not.toHaveBeenCalled();
      expect(resultado.checkout?.id).toBe(CHECKOUT_ID);
      expect(mockPrisma.reserva.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: RESERVA_ID } }),
      );
    });

    it('registra enderecoIp nulo quando a requisição não informa IP', async () => {
      prepararPost();

      await postar();

      expect(primeiro(tx.logAuditoria.create).data.enderecoIp).toBeNull();
    });

    it('não atualiza a reserva quando ela já estava FINALIZADA', async () => {
      prepararPost();
      tx.reserva.findUnique.mockResolvedValueOnce({
        status: StatusReserva.FINALIZADA,
      });

      const resultado = await postar();

      expect(tx.reserva.update).not.toHaveBeenCalled();
      expect(tx.checkOut.create).toHaveBeenCalledTimes(1);
      expect(
        primeiro(tx.logAuditoria.create).data.dadosNovos.statusAnterior,
      ).toBe(StatusReserva.FINALIZADA);
      expect(resultado.checkout?.id).toBe(CHECKOUT_ID);
    });

    it('omite statusNovo da auditoria quando a reserva já estava FINALIZADA', async () => {
      prepararPost();
      tx.reserva.findUnique.mockResolvedValueOnce({
        status: StatusReserva.FINALIZADA,
      });

      const resultado = await postar();

      const auditoria = primeiro(tx.logAuditoria.create).data;
      // Sem transição real, `statusNovo` não existe (null não entra no log).
      expect(auditoria.dadosNovos).not.toHaveProperty('statusNovo');
      expect(auditoria.dadosNovos.statusAnterior).toBe(
        StatusReserva.FINALIZADA,
      );
      expect(tx.reserva.update).not.toHaveBeenCalled();
      expect(resultado.checkout?.id).toBe(CHECKOUT_ID);
    });

    it('não escreve em Pagamento nem chama quarto.update em nenhum caminho', async () => {
      prepararPost();

      await postar({}, PERFIL_ESTAB, USUARIO_ID, '10.1.2.3');

      expect(mockPrisma.pagamento.create).not.toHaveBeenCalled();
      expect(mockPrisma.pagamento.update).not.toHaveBeenCalled();
      expect(mockPrisma.pagamento.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.pagamento.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.quarto.update).not.toHaveBeenCalled();
      expect(mockPrisma.quarto.updateMany).not.toHaveBeenCalled();
      expect(tx.pagamento.update).not.toHaveBeenCalled();
      expect(tx.quarto.update).not.toHaveBeenCalled();
    });

    it('ADMIN pode fazer check-out em reserva de qualquer estabelecimento', async () => {
      prepararPost({ estabelecimentoId: OUTRO_ESTAB_ID });

      await postar({}, PERFIL_ADMIN);

      expect(tx.checkOut.create).toHaveBeenCalledTimes(1);
    });

    it('normaliza observações com trim antes de persistir', async () => {
      prepararPost();

      await postar({ observacoes: '  Saída às 10h  ' });

      expect(primeiro(tx.checkOut.create).data.observacoes).toBe(
        'Saída às 10h',
      );
    });

    it('grava observações nulas quando o texto é só espaço', async () => {
      prepararPost();

      await postar({ observacoes: '   ' });

      expect(primeiro(tx.checkOut.create).data.observacoes).toBeNull();
    });

    it('grava observações nulas quando o campo é omitido', async () => {
      prepararPost();

      await postar();

      expect(primeiro(tx.checkOut.create).data.observacoes).toBeNull();
    });

    it('usa o usuário do token como responsável do check-out', async () => {
      const outroUsuario = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      prepararPost();

      await postar({}, PERFIL_ESTAB, outroUsuario);

      expect(primeiro(tx.checkOut.create).data.responsavelId).toBe(
        outroUsuario,
      );
      expect(primeiro(tx.logAuditoria.create).data.usuarioId).toBe(
        outroUsuario,
      );
    });
  });

  // =========================================================================
  // 13. POST — concorrência (unique de reservaId)
  // =========================================================================

  describe('POST — concorrência e idempotência', () => {
    it('rechecagem dentro da transação encontra CheckOut concorrente e devolve 409', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());
      tx.checkOut.findUnique.mockResolvedValueOnce({ id: CHECKOUT_ID });

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);
      expect(tx.checkOut.create).not.toHaveBeenCalled();
      expect(tx.logAuditoria.create).not.toHaveBeenCalled();
    });

    it('converte P2002 de CheckOut.reservaId (corrida de duplo check-out) em 409', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());
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
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());
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

    it('converte P2002 sem meta ou com meta.target undefined em 409 (não 500)', async () => {
      // Driver que não devolve `meta` nenhum.
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);

      // `meta` presente, mas sem `target` (undefined explícito).
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: undefined },
        }),
      );

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);
    });

    it('converte P2002 com meta.target vazio em 409 (alvo indeterminado)', async () => {
      // Inferência aceita: a única unique de `CheckOut` é `reserva_id` (1:1 com a
      // reserva), então um P2002 vindo deste `create` sem alvo identificável só
      // pode ser duplicidade de check-out.
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(reservaPreCheckout());
      mockPrisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
          meta: { target: [] },
        }),
      );

      await expect(postar()).rejects.toBeInstanceOf(ConflictException);
    });

    it('é idempotente: check-in e check-out existentes devolvem 409 sem transação', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce(
        reservaPreCheckout({ checkout: { id: CHECKOUT_ID } }),
      );

      await expect(postar()).rejects.toThrow(
        /Check-out já realizado para esta reserva/,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('400 quando a reserva é cancelada entre a pré-checagem e a transação', async () => {
      prepararPost();
      tx.reserva.findUnique.mockResolvedValueOnce({
        status: StatusReserva.CANCELADA,
      });

      await expect(postar()).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.checkOut.create).not.toHaveBeenCalled();
      expect(tx.logAuditoria.create).not.toHaveBeenCalled();
    });
  });
});
