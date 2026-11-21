/**
 * Testes do CheckinsController.
 *
 * Cobre o contrato HTTP que o guard não vê:
 * - metadados `@Roles(ESTABELECIMENTO, ADMIN)` nas 3 rotas (fonte: RolesGuard);
 * - `@HttpCode(201)` no POST;
 * - delegação para o service (query/usuário/perfil/IP passam intactos);
 * - validação do DTO de entrada (o que o ValidationPipe global barra com 400).
 *
 * Nenhuma dependência real: o service é substituído por um mock.
 */
import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PerfilUsuario } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';
import { CreateCheckInDto } from './dto/checkin.dto';

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';
const RESERVA_ID = '77777777-7777-4777-8777-777777777777';

const serviceMock = {
  list: jest.fn(),
  detail: jest.fn(),
  create: jest.fn(),
};

describe('CheckinsController', () => {
  let controller: CheckinsController;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckinsController],
      providers: [{ provide: CheckinsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<CheckinsController>(CheckinsController);
  });

  describe('autorização declarada', () => {
    it.each(['list', 'detail', 'create'])(
      'declara @Roles(ESTABELECIMENTO, ADMIN) na rota %s',
      (metodo) => {
        const roles = Reflect.getMetadata(
          ROLES_KEY,
          (CheckinsController.prototype as unknown as Record<string, unknown>)[
            metodo
          ] as object,
        );

        expect(roles).toEqual([
          PerfilUsuario.ESTABELECIMENTO,
          PerfilUsuario.ADMIN,
        ]);
      },
    );

    it('declara POST /checkins com status HTTP 201', () => {
      const codigo = Reflect.getMetadata(
        HTTP_CODE_METADATA,
        CheckinsController.prototype.create,
      );

      expect(codigo).toBe(HttpStatus.CREATED);
    });
  });

  describe('delegação para o service', () => {
    it('lista check-ins repassando query, usuário e perfil do token', async () => {
      const query = { situacao: 'PENDENTES' } as never;
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

    it('detalha check-in repassando o id da reserva e o escopo do token', async () => {
      serviceMock.detail.mockResolvedValueOnce({ reserva: {}, checkin: null });

      await controller.detail(RESERVA_ID, USUARIO_ID, PerfilUsuario.ADMIN);

      expect(serviceMock.detail).toHaveBeenCalledWith(
        RESERVA_ID,
        USUARIO_ID,
        PerfilUsuario.ADMIN,
      );
    });

    it('registra check-in repassando dto, escopo e IP da requisição', async () => {
      const dto = { reservaId: RESERVA_ID } as CreateCheckInDto;
      serviceMock.create.mockResolvedValueOnce({ reserva: {}, checkin: {} });

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

  describe('validação do CreateCheckInDto (ValidationPipe global)', () => {
    const validar = (payload: Record<string, unknown>) =>
      validate(plainToInstance(CreateCheckInDto, payload));

    it('aceita payload mínimo válido (apenas reservaId)', async () => {
      const erros = await validar({ reservaId: RESERVA_ID });

      expect(erros).toHaveLength(0);
    });

    it('recusa reservaId que não é UUID', async () => {
      const erros = await validar({ reservaId: 'nao-e-uuid' });

      expect(erros.map((erro) => erro.property)).toContain('reservaId');
    });

    it('recusa acompanhante sem nome', async () => {
      const erros = await validar({
        reservaId: RESERVA_ID,
        acompanhantes: [{ presente: true }],
      });

      expect(erros.some((erro) => erro.property === 'acompanhantes')).toBe(
        true,
      );
    });

    it('recusa mais de 20 acompanhantes', async () => {
      const erros = await validar({
        reservaId: RESERVA_ID,
        acompanhantes: Array.from({ length: 21 }, (_, indice) => ({
          nome: `Acompanhante ${indice}`,
        })),
      });

      expect(erros.map((erro) => erro.property)).toContain('acompanhantes');
    });

    it('recusa data de nascimento fora do formato YYYY-MM-DD', async () => {
      const erros = await validar({
        reservaId: RESERVA_ID,
        hospedePrincipal: { dataNascimento: '25/10/1995' },
      });

      expect(erros.some((erro) => erro.property === 'hospedePrincipal')).toBe(
        true,
      );
    });
  });
});
