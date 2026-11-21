/**
 * Regressão da guarda de cancelamento × check-in.
 *
 * A feature de check-in adicionou a regra "reserva com chegada registrada não
 * pode ser cancelada" em `ReservationsService.cancel` (evita `CheckIn` órfão de
 * reserva CANCELADA). Este spec vive junto do módulo de check-in de propósito:
 * é o efeito colateral do check-in sobre o ciclo de vida da reserva e precisa
 * rodar junto de `src/modules/reservas/checkins`.
 *
 * `PrismaService`, `RoomsService` e `NotificationsService` são mockados:
 * nenhum banco/e-mail real é tocado.
 */
import { BadRequestException } from '@nestjs/common';
import { ReservationsService } from '../reservas.service';

const RESERVA_ID = '77777777-7777-4777-8777-777777777777';
const HOSPEDE_ID = '33333333-3333-4333-8333-333333333333';
const ESTAB_ID = '44444444-4444-4444-8444-444444444444';
const PROPRIETARIO_ID = '11111111-1111-4111-8111-111111111111';
const CHECKIN_ID = '99999999-9999-4999-8999-999999999999';

const mockPrisma = {
  reserva: { findUnique: jest.fn(), update: jest.fn() },
  estabelecimento: { findUnique: jest.fn() },
  checkIn: { findUnique: jest.fn() },
};

const roomsService = {
  checkAvailability: jest.fn(),
  calculatePrice: jest.fn(),
};
const notifications = {
  sendReservationCancelled: jest.fn().mockResolvedValue(undefined),
};

function reserva(overrides: Record<string, unknown> = {}) {
  return {
    id: RESERVA_ID,
    codigoReserva: 'HRN1234567',
    hospedeId: HOSPEDE_ID,
    estabelecimentoId: ESTAB_ID,
    status: 'CONFIRMADA',
    valorTotal: 331.5,
    cancelamentoMotivo: null,
    hospede: { id: HOSPEDE_ID, nome: 'Maria', email: 'maria@example.com' },
    estabelecimento: { id: ESTAB_ID, nome: 'Pousada Teste' },
    ...overrides,
  };
}

describe('ReservationsService — cancelamento com check-in (regressão)', () => {
  let service: ReservationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    notifications.sendReservationCancelled.mockResolvedValue(undefined);
    mockPrisma.estabelecimento.findUnique.mockResolvedValue({
      id: ESTAB_ID,
      proprietarioId: PROPRIETARIO_ID,
    });
    mockPrisma.checkIn.findUnique.mockResolvedValue(null);
    mockPrisma.reserva.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        reserva({
          status: 'CANCELADA',
          cancelamentoMotivo: data.cancelamentoMotivo ?? null,
        }),
    );

    service = new ReservationsService(
      mockPrisma as never,
      roomsService as never,
      notifications as never,
    );
  });

  it('recusa (400) cancelar reserva que já possui check-in', async () => {
    mockPrisma.reserva.findUnique.mockResolvedValueOnce(reserva());
    mockPrisma.checkIn.findUnique.mockResolvedValueOnce({ id: CHECKIN_ID });

    const erro = await service
      .cancel(
        RESERVA_ID,
        { motivo: 'Hóspede pediu' } as never,
        PROPRIETARIO_ID,
        'ESTABELECIMENTO',
      )
      .catch((capturado: Error) => capturado);

    expect(erro).toBeInstanceOf(BadRequestException);
    expect((erro as Error).message).toMatch(
      /check-in já realizado não pode ser cancelada/,
    );
  });

  it('verifica a existência do check-in pelo reservaId antes de atualizar', async () => {
    mockPrisma.reserva.findUnique.mockResolvedValueOnce(reserva());
    mockPrisma.checkIn.findUnique.mockResolvedValueOnce({ id: CHECKIN_ID });

    await expect(
      service.cancel(
        RESERVA_ID,
        { motivo: 'Hóspede pediu' } as never,
        PROPRIETARIO_ID,
        'ESTABELECIMENTO',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockPrisma.checkIn.findUnique).toHaveBeenCalledWith({
      where: { reservaId: RESERVA_ID },
      select: { id: true },
    });
    expect(mockPrisma.reserva.update).not.toHaveBeenCalled();
    expect(notifications.sendReservationCancelled).not.toHaveBeenCalled();
  });

  it('mantém a precedência: FINALIZADA nem consulta o check-in', async () => {
    mockPrisma.reserva.findUnique.mockResolvedValueOnce(
      reserva({ status: 'FINALIZADA' }),
    );

    await expect(
      service.cancel(
        RESERVA_ID,
        { motivo: 'x' } as never,
        PROPRIETARIO_ID,
        'ESTABELECIMENTO',
      ),
    ).rejects.toThrow(/Esta reserva não pode ser cancelada/);
    expect(mockPrisma.checkIn.findUnique).not.toHaveBeenCalled();
  });

  it('cancela reserva sem check-in e notifica o hóspede', async () => {
    mockPrisma.reserva.findUnique.mockResolvedValueOnce(reserva());
    mockPrisma.checkIn.findUnique.mockResolvedValueOnce(null);

    const resultado = await service.cancel(
      RESERVA_ID,
      { motivo: 'Hóspede pediu' } as never,
      PROPRIETARIO_ID,
      'ESTABELECIMENTO',
    );

    expect(mockPrisma.reserva.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESERVA_ID },
        data: { status: 'CANCELADA', cancelamentoMotivo: 'Hóspede pediu' },
      }),
    );
    expect(notifications.sendReservationCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'maria@example.com' }),
    );
    expect(resultado.status).toBe('CANCELADA');
  });
});
