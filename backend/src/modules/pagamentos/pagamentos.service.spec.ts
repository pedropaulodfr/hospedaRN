import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from './pagamentos.service';

const RESERVA_ID = '11111111-1111-4111-8111-111111111111';

const mockPrisma = {
  reserva: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  pagamento: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const notifications = {
  sendPaymentMercadoPagoConfirmed: jest.fn().mockResolvedValue(undefined),
  sendPaymentMercadoPagoConfirmedToEstablishment: jest
    .fn()
    .mockResolvedValue(undefined),
  sendPaymentUploaded: jest.fn().mockResolvedValue(undefined),
  sendPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
};

const mercadoPago = {
  accessToken: 'TEST-token' as string | undefined,
  validateWebhookSignature: jest.fn(),
  getPayment: jest.fn(),
  findPaymentByExternalReference: jest.fn(),
  createCheckout: jest.fn(),
};

const uploads = { uploadFile: jest.fn() };

const reservaBase = {
  id: RESERVA_ID,
  codigoReserva: 'HRNTEST1',
  status: 'CONFIRMADA',
  modoPagamento: 'MERCADO_PAGO',
  valorTotal: 331.5,
  checkIn: new Date('2026-12-01T00:00:00.000Z'),
  checkOut: new Date('2026-12-03T00:00:00.000Z'),
  hospedeId: 'hospede-1',
  hospede: {
    id: 'hospede-1',
    nome: 'Maria de Souza',
    email: 'maria@example.com',
    hospede: { cpf: '123.456.789-09', endereco: null },
  },
  estabelecimento: {
    id: 'estab-1',
    nome: 'Pousada Teste',
    modoPagamento: 'MERCADO_PAGO',
    proprietarioId: 'dono-1',
    emailContato: 'dono@example.com',
    proprietario: { email: 'dono@example.com' },
  },
};

const pagamentoBase = {
  id: 'pagamento-1',
  reservaId: RESERVA_ID,
  status: 'PENDENTE',
  metodo: 'PIX',
  codigoTransacao: '5555',
  dadosPagamento: { mpTipo: 'payment', metodo: 'PIX', pixCopyPaste: '000201' },
  reserva: reservaBase,
};

describe('PaymentsService — modo Mercado Pago', () => {
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (arg: any) =>
      typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
    );
    service = new PaymentsService(
      mockPrisma as any,
      uploads as any,
      notifications as any,
      mercadoPago as any,
    );
  });

  describe('createMercadoPagoCheckout', () => {
    it('deve recusar pagamento antes da aprovação do estabelecimento', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce({
        ...reservaBase,
        status: 'SOLICITADA',
        pagamento: null,
      });

      await expect(
        service.createMercadoPagoCheckout(RESERVA_ID, 'PIX'),
      ).rejects.toThrow(/Aguardando a aprovação do estabelecimento/);
    });

    it('deve respeitar o snapshot da reserva (PADRAO mesmo com estabelecimento em MP)', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce({
        ...reservaBase,
        modoPagamento: 'PADRAO',
        pagamento: null,
      });

      await expect(
        service.createMercadoPagoCheckout(RESERVA_ID, 'PIX'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deve reaproveitar a cobrança existente do mesmo método', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce({
        ...reservaBase,
        pagamento: pagamentoBase,
      });

      const resultado = await service.createMercadoPagoCheckout(
        RESERVA_ID,
        'PIX',
      );

      expect(resultado.paymentId).toBe('5555');
      expect(resultado.checkout.pixCopyPaste).toBe('000201');
      expect(mercadoPago.createCheckout).not.toHaveBeenCalled();
    });

    it('deve gravar o checkout real gerado pelo Mercado Pago', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce({
        ...reservaBase,
        pagamento: null,
      });
      mercadoPago.createCheckout.mockResolvedValueOnce({
        metodo: 'PIX',
        paymentId: '777',
        tipo: 'payment',
        status: 'pending',
        checkout: { qrCodeBase64: 'data:image/png;base64,abc', pixCopyPaste: '000201x' },
      });
      mockPrisma.pagamento.create.mockResolvedValueOnce({});

      const resultado = await service.createMercadoPagoCheckout(
        RESERVA_ID,
        'PIX',
      );

      expect(resultado.paymentId).toBe('777');
      expect(mockPrisma.pagamento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservaId: RESERVA_ID,
            status: 'PENDENTE',
          }),
        }),
      );
      expect(mercadoPago.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          pagadorCpf: '123.456.789-09',
          valor: 331.5,
        }),
      );
    });
  });

  describe('handleMercadoPagoWebhook', () => {
    beforeEach(() => {
      mercadoPago.validateWebhookSignature.mockReturnValue(true);
    });

    it('deve recusar quando a assinatura é inválida', async () => {
      mercadoPago.validateWebhookSignature.mockReturnValueOnce(false);

      await expect(
        service.handleMercadoPagoWebhook({ paymentId: '1' }),
      ).rejects.toThrow(/Assinatura/);
    });

    it('deve finalizar a reserva quando o MP aprova o pagamento', async () => {
      mercadoPago.getPayment.mockResolvedValueOnce({
        id: '999',
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: RESERVA_ID,
        paymentMethodId: 'pix',
        transactionAmount: 331.5,
        currencyId: 'BRL',
      });
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce(pagamentoBase);
      mockPrisma.pagamento.updateMany.mockResolvedValueOnce({ count: 1 });

      const resultado = await service.handleMercadoPagoWebhook({
        paymentId: '999',
      });

      expect(resultado.processed).toBe(true);
      expect(mockPrisma.reserva.update).toHaveBeenCalledWith({
        where: { id: RESERVA_ID },
        data: { status: 'FINALIZADA' },
      });
      expect(
        notifications.sendPaymentMercadoPagoConfirmed,
      ).toHaveBeenCalledTimes(1);
      expect(
        notifications.sendPaymentMercadoPagoConfirmedToEstablishment,
      ).toHaveBeenCalledTimes(1);
    });

    it('não deve finalizar duas vezes (webhook duplicado)', async () => {
      mercadoPago.getPayment.mockResolvedValueOnce({
        id: '999',
        status: 'approved',
        externalReference: RESERVA_ID,
        transactionAmount: 331.5,
        currencyId: 'BRL',
      });
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce(pagamentoBase);
      mockPrisma.pagamento.updateMany.mockResolvedValueOnce({ count: 0 });

      const resultado = await service.handleMercadoPagoWebhook({
        paymentId: '999',
      });

      expect(resultado.processed).toBe(false);
      expect(mockPrisma.reserva.update).not.toHaveBeenCalled();
      expect(
        notifications.sendPaymentMercadoPagoConfirmed,
      ).not.toHaveBeenCalled();
    });

    it('não deve confirmar quando o status não é aprovado', async () => {
      mercadoPago.getPayment.mockResolvedValueOnce({
        id: '999',
        status: 'pending',
        externalReference: RESERVA_ID,
        transactionAmount: 331.5,
        currencyId: 'BRL',
      });

      const resultado = await service.handleMercadoPagoWebhook({
        paymentId: '999',
      });

      expect(resultado.processed).toBe(false);
      expect(mockPrisma.pagamento.updateMany).not.toHaveBeenCalled();
    });

    it('não deve finalizar quando o valor pago diverge do total da reserva', async () => {
      mercadoPago.getPayment.mockResolvedValueOnce({
        id: '999',
        status: 'approved',
        externalReference: RESERVA_ID,
        transactionAmount: 10,
        currencyId: 'BRL',
      });
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce(pagamentoBase);
      mockPrisma.pagamento.update.mockResolvedValueOnce({});

      const resultado = await service.handleMercadoPagoWebhook({
        paymentId: '999',
      });

      expect(resultado.processed).toBe(false);
      expect(mockPrisma.pagamento.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.reserva.update).not.toHaveBeenCalled();
      expect(
        notifications.sendPaymentMercadoPagoConfirmed,
      ).not.toHaveBeenCalled();
    });

    it('deve devolver erro para o MP reenviar quando a consulta falha', async () => {
      mercadoPago.getPayment.mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { status: 500 }),
      );

      await expect(
        service.handleMercadoPagoWebhook({ paymentId: '999' }),
      ).rejects.toThrow(/Não foi possível consultar/);
    });
  });

  describe('syncMercadoPagoPayment', () => {
    it('deve reconhecer o pagamento aprovado consultando o MP', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce({
        ...reservaBase,
        pagamento: pagamentoBase,
      });
      mercadoPago.getPayment.mockResolvedValueOnce({
        id: '999',
        status: 'approved',
        externalReference: RESERVA_ID,
        transactionAmount: 331.5,
        currencyId: 'BRL',
      });
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce(pagamentoBase);
      mockPrisma.pagamento.updateMany.mockResolvedValueOnce({ count: 1 });

      const resultado = await service.syncMercadoPagoPayment(
        RESERVA_ID,
        'hospede-1',
        'HOSPEDE',
      );

      expect(resultado.status).toBe('CONFIRMADO');
      expect(mockPrisma.reserva.update).toHaveBeenCalledWith({
        where: { id: RESERVA_ID },
        data: { status: 'FINALIZADA' },
      });
    });

    it('deve barrar quem não é dono da reserva', async () => {
      mockPrisma.reserva.findUnique.mockResolvedValueOnce({
        ...reservaBase,
        pagamento: pagamentoBase,
      });

      await expect(
        service.syncMercadoPagoPayment(RESERVA_ID, 'outro-usuario', 'HOSPEDE'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('reconciliarMercadoPagoPendentes', () => {
    beforeEach(() => {
      mercadoPago.accessToken = 'TEST-token';
    });

    it('deve confirmar automaticamente a cobrança pendente que o MP aprovou', async () => {
      mockPrisma.pagamento.findMany.mockResolvedValueOnce([
        {
          id: 'pagamento-1',
          reservaId: RESERVA_ID,
          codigoTransacao: '5555',
          dadosPagamento: { mpTipo: 'payment', metodo: 'PIX', mpStatus: 'pending' },
          criadoEm: new Date(),
        },
      ]);
      mercadoPago.getPayment.mockResolvedValueOnce({
        id: '999',
        status: 'approved',
        statusDetail: 'accredited',
        externalReference: RESERVA_ID,
        paymentMethodId: 'pix',
        transactionAmount: 331.5,
        currencyId: 'BRL',
      });
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce(pagamentoBase);
      mockPrisma.pagamento.updateMany.mockResolvedValueOnce({ count: 1 });

      const resumo = await service.reconciliarMercadoPagoPendentes();

      expect(resumo.habilitado).toBe(true);
      expect(resumo.verificados).toBe(1);
      expect(resumo.confirmados).toBe(1);
      expect(mockPrisma.reserva.update).toHaveBeenCalledWith({
        where: { id: RESERVA_ID },
        data: { status: 'FINALIZADA' },
      });
      expect(
        notifications.sendPaymentMercadoPagoConfirmed,
      ).toHaveBeenCalledTimes(1);
    });

    it('deve manter pendente e registrar o último status do MP', async () => {
      mockPrisma.pagamento.findMany.mockResolvedValueOnce([
        {
          id: 'pagamento-1',
          reservaId: RESERVA_ID,
          codigoTransacao: '5555',
          dadosPagamento: { mpTipo: 'payment', metodo: 'PIX', mpStatus: 'pending' },
          criadoEm: new Date(),
        },
      ]);
      mercadoPago.getPayment.mockResolvedValueOnce({
        id: '5555',
        status: 'in_process',
        externalReference: RESERVA_ID,
        transactionAmount: 331.5,
        currencyId: 'BRL',
      });
      mockPrisma.pagamento.update.mockResolvedValueOnce({});

      const resumo = await service.reconciliarMercadoPagoPendentes();

      expect(resumo.confirmados).toBe(0);
      expect(resumo.pendentes).toBe(1);
      expect(mockPrisma.pagamento.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.pagamento.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pagamento-1' } }),
      );
    });

    it('deve buscar o pagamento por external_reference quando a cobrança é do Checkout Pro', async () => {
      mockPrisma.pagamento.findMany.mockResolvedValueOnce([
        {
          id: 'pagamento-2',
          reservaId: RESERVA_ID,
          codigoTransacao: 'pref-1',
          dadosPagamento: { mpTipo: 'preference', metodo: 'CARTAO' },
          criadoEm: new Date(),
        },
      ]);
      mercadoPago.findPaymentByExternalReference.mockResolvedValueOnce({
        id: '1000',
        status: 'approved',
        externalReference: RESERVA_ID,
        transactionAmount: 331.5,
        currencyId: 'BRL',
      });
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce(pagamentoBase);
      mockPrisma.pagamento.updateMany.mockResolvedValueOnce({ count: 1 });

      const resumo = await service.reconciliarMercadoPagoPendentes();

      expect(mercadoPago.findPaymentByExternalReference).toHaveBeenCalledWith(
        RESERVA_ID,
      );
      expect(resumo.confirmados).toBe(1);
    });

    it('não deve consultar o MP quando a credencial não está configurada', async () => {
      mercadoPago.accessToken = undefined;

      const resumo = await service.reconciliarMercadoPagoPendentes();

      expect(resumo.habilitado).toBe(false);
      expect(mockPrisma.pagamento.findMany).not.toHaveBeenCalled();
    });

    it('deve limitar o lote e a janela de cobranças por ciclo', async () => {
      mockPrisma.pagamento.findMany.mockResolvedValueOnce([]);

      await service.reconciliarMercadoPagoPendentes({ lote: 500, janelaHoras: 9999 });

      const args = mockPrisma.pagamento.findMany.mock.calls[0][0];
      expect(args.take).toBe(100);
    });
  });

  describe('bloqueios do modo Mercado Pago', () => {
    it('deve proibir aprovação manual de pagamento MP', async () => {
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce({
        id: 'pagamento-1',
        reserva: {
          modoPagamento: 'MERCADO_PAGO',
          estabelecimento: { modoPagamento: 'MERCADO_PAGO' },
        },
      });

      await expect(service.confirm('pagamento-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('deve proibir envio de comprovante em modo MP', async () => {
      mockPrisma.pagamento.findUnique.mockResolvedValueOnce({
        id: 'pagamento-1',
        reserva: {
          modoPagamento: 'MERCADO_PAGO',
          estabelecimento: { modoPagamento: 'MERCADO_PAGO' },
        },
      });

      await expect(
        service.uploadComprovante(
          'pagamento-1',
          Buffer.from('x'),
          'c.pdf',
          'application/pdf',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(uploads.uploadFile).not.toHaveBeenCalled();
    });
  });
});
