/**
 * Testes do CheckoutsController.
 *
 * Cobre o contrato HTTP que o guard não vê:
 * - metadados `@Roles(ESTABELECIMENTO, ADMIN)` nas 3 rotas (fonte: RolesGuard);
 * - `@HttpCode(201)` no POST;
 * - `ParseUUIDPipe` declarado no parâmetro `reservaId` do detalhe (400 sem ele);
 * - delegação para o service (query/usuário/perfil/IP passam intactos);
 * - validação dos DTOs de entrada (o que o ValidationPipe global barra com 400).
 *
 * Nenhuma dependência real: o service é substituído por um mock tipado.
 */
import { BadRequestException, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PerfilUsuario } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { CheckoutsController } from './checkouts.controller';
import { CheckoutsService } from './checkouts.service';
import { CreateCheckOutDto, ListCheckoutsQueryDto } from './dto/checkout.dto';

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';
const RESERVA_ID = '77777777-7777-4777-8777-777777777777';

type RotaCheckout = 'list' | 'detail' | 'create';

/** Metadados dos parâmetros de uma rota (o que o Nest usa para aplicar pipes). */
interface MetadadosParametro {
  data?: string;
  pipes?: unknown[];
}

const serviceMock = {
  list: jest.fn<Promise<unknown>, [ListCheckoutsQueryDto, string, string]>(),
  detail: jest.fn<Promise<unknown>, [string, string, string]>(),
  create: jest.fn<
    Promise<unknown>,
    [CreateCheckOutDto, string, string, string | undefined]
  >(),
};

/** Referência ao handler da rota, sem disparar `unbound-method` no lint. */
function alvoDaRota(rota: RotaCheckout): object {
  const prototipo = CheckoutsController.prototype as unknown as Record<
    RotaCheckout,
    object
  >;
  return prototipo[rota];
}

/** Metadados `ROUTE_ARGS_METADATA` de uma rota do controller. */
function metadadosDaRota(rota: RotaCheckout): MetadadosParametro[] {
  const metadados = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    CheckoutsController,
    rota,
  ) as Record<string, MetadadosParametro>;

  return Object.values(metadados);
}

/** Aplica um `ParseUUIDPipe` como o Nest faria no parâmetro da rota. */
async function aplicarPipeUuid(valor: string): Promise<unknown> {
  const resultado: Promise<unknown> = new ParseUUIDPipe().transform(valor, {
    type: 'param',
  });
  return resultado;
}

describe('CheckoutsController', () => {
  let controller: CheckoutsController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutsController],
      providers: [{ provide: CheckoutsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<CheckoutsController>(CheckoutsController);
  });

  describe('autorização declarada', () => {
    it.each(['list', 'detail', 'create'] as RotaCheckout[])(
      'declara @Roles(ESTABELECIMENTO, ADMIN) na rota %s',
      (rota) => {
        expect(Reflect.getMetadata(ROLES_KEY, alvoDaRota(rota))).toEqual([
          PerfilUsuario.ESTABELECIMENTO,
          PerfilUsuario.ADMIN,
        ]);
      },
    );

    it('declara POST /checkouts com status HTTP 201', () => {
      const codigo: unknown = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        alvoDaRota('create'),
      );

      expect(codigo).toBe(HttpStatus.CREATED);
    });
  });

  describe('GET /checkouts/:reservaId — validação do parâmetro', () => {
    it('declara ParseUUIDPipe no parâmetro reservaId', () => {
      const parametro = metadadosDaRota('detail').find(
        (meta) => meta.data === 'reservaId',
      );

      expect(parametro?.pipes?.[0]).toBeInstanceOf(ParseUUIDPipe);
    });

    it('rejeita com 400 um id que não é UUID', async () => {
      await expect(aplicarPipeUuid('nao-e-uuid')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('aceita um UUID válido', async () => {
      await expect(aplicarPipeUuid(RESERVA_ID)).resolves.toBe(RESERVA_ID);
    });
  });

  describe('delegação para o service', () => {
    it('lista check-outs repassando query, usuário e perfil do token', async () => {
      const query: ListCheckoutsQueryDto = { situacao: 'REALIZADOS' };
      const retorno = { data: [], total: 0 };
      serviceMock.list.mockResolvedValueOnce(retorno);

      const resultado = await controller.list(
        query,
        USUARIO_ID,
        PerfilUsuario.ESTABELECIMENTO,
      );

      expect(serviceMock.list).toHaveBeenCalledWith(
        query,
        USUARIO_ID,
        PerfilUsuario.ESTABELECIMENTO,
      );
      expect(resultado).toBe(retorno);
    });

    it('detalha a saída repassando o id da reserva e o escopo do token', async () => {
      serviceMock.detail.mockResolvedValueOnce({
        reserva: {},
        checkout: null,
      });

      await controller.detail(RESERVA_ID, USUARIO_ID, PerfilUsuario.ADMIN);

      expect(serviceMock.detail).toHaveBeenCalledWith(
        RESERVA_ID,
        USUARIO_ID,
        PerfilUsuario.ADMIN,
      );
    });

    it('registra o check-out repassando dto, escopo e IP da requisição', async () => {
      const dto: CreateCheckOutDto = { reservaId: RESERVA_ID };
      serviceMock.create.mockResolvedValueOnce({ reserva: {}, checkout: {} });

      await controller.create(
        dto,
        USUARIO_ID,
        PerfilUsuario.ESTABELECIMENTO,
        '10.0.0.7',
      );

      expect(serviceMock.create).toHaveBeenCalledWith(
        dto,
        USUARIO_ID,
        PerfilUsuario.ESTABELECIMENTO,
        '10.0.0.7',
      );
    });
  });

  describe('validação do CreateCheckOutDto (ValidationPipe global)', () => {
    const validar = (payload: Record<string, unknown>) =>
      validate(plainToInstance(CreateCheckOutDto, payload));

    it('aceita payload mínimo válido (apenas reservaId)', async () => {
      const erros = await validar({ reservaId: RESERVA_ID });

      expect(erros).toHaveLength(0);
    });

    it('recusa reservaId que não é UUID', async () => {
      const erros = await validar({ reservaId: 'nao-e-uuid' });

      expect(erros.map((erro) => erro.property)).toContain('reservaId');
    });

    it('recusa observacoes com mais de 1000 caracteres', async () => {
      const erros = await validar({
        reservaId: RESERVA_ID,
        observacoes: 'a'.repeat(1001),
      });

      expect(erros.map((erro) => erro.property)).toContain('observacoes');
    });

    it('aceita observacoes com exatamente 1000 caracteres', async () => {
      const erros = await validar({
        reservaId: RESERVA_ID,
        observacoes: 'a'.repeat(1000),
      });

      expect(erros).toHaveLength(0);
    });

    it('recusa realizadoEm fora de ISO 8601', async () => {
      const erros = await validar({
        reservaId: RESERVA_ID,
        realizadoEm: '20/11/2026 10:00',
      });

      expect(erros.map((erro) => erro.property)).toContain('realizadoEm');
    });

    it('aceita realizadoEm em ISO 8601', async () => {
      const erros = await validar({
        reservaId: RESERVA_ID,
        realizadoEm: '2026-11-20T10:30:00.000Z',
      });

      expect(erros).toHaveLength(0);
    });
  });

  describe('validação do ListCheckoutsQueryDto (ValidationPipe global)', () => {
    const validarQuery = (payload: Record<string, unknown>) =>
      validate(plainToInstance(ListCheckoutsQueryDto, payload));

    it('aceita query vazia (defaults de TODOS e paginação)', async () => {
      const erros = await validarQuery({});

      expect(erros).toHaveLength(0);
    });

    it('recusa situacao fora da lista permitida', async () => {
      const erros = await validarQuery({ situacao: 'FINALIZADOS' });

      expect(erros.map((erro) => erro.property)).toContain('situacao');
    });

    it('recusa limit maior que 100', async () => {
      const erros = await validarQuery({ limit: 101 });

      expect(erros.map((erro) => erro.property)).toContain('limit');
    });

    it('recusa data fora do formato YYYY-MM-DD', async () => {
      const erros = await validarQuery({ data: '20/11/2026' });

      expect(erros.map((erro) => erro.property)).toContain('data');
    });

    it('recusa estabelecimentoId que não é UUID', async () => {
      const erros = await validarQuery({ estabelecimentoId: 'outra-pousada' });

      expect(erros.map((erro) => erro.property)).toContain('estabelecimentoId');
    });
  });
});
