import { BadRequestException } from '@nestjs/common';
import { MercadoPagoService } from './mercado-pago.service';

const mockPaymentCreate = jest.fn();
const mockPaymentGet = jest.fn();
const mockPaymentSearch = jest.fn();
const mockPreferenceCreate = jest.fn();
const mockValidateSignature = jest.fn();

jest.mock('mercadopago', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
  MercadoPagoConfig: jest.fn().mockImplementation(() => ({})),
  Payment: jest.fn().mockImplementation(() => ({
    create: mockPaymentCreate,
    get: mockPaymentGet,
    search: mockPaymentSearch,
  })),
  Preference: jest.fn().mockImplementation(() => ({
    create: mockPreferenceCreate,
  })),
  WebhookSignatureValidator: {
    validate: (...args: unknown[]) => mockValidateSignature(...args),
  },
}));

const ENV: Record<string, string> = {
  MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token',
  MERCADO_PAGO_PUBLIC_KEY: 'TEST-public',
  FRONTEND_URL: 'http://localhost:5173',
  NODE_ENV: 'test',
};

const configService = {
  get: (key: string) => ENV[key],
};

const paramsBase = {
  reservaId: 'reserva-1',
  codigoReserva: 'HRNTEST1',
  valor: 331.5,
  pagadorEmail: 'hospede@example.com',
  pagadorNome: 'Maria de Souza',
  pagadorCpf: '123.456.789-09',
  pagadorEndereco: null,
  estabelecimentoNome: 'Pousada Teste',
};

describe('MercadoPagoService', () => {
  let service: MercadoPagoService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete ENV.MERCADO_PAGO_WEBHOOK_SECRET;
    ENV.NODE_ENV = 'test';
    service = new MercadoPagoService(configService as any);
  });

  describe('validateWebhookSignature', () => {
    it('deve recusar a notificação quando o secret não está configurado (fail-closed)', () => {
      const valido = service.validateWebhookSignature({
        xSignature: 'ts=1,v1=abc',
        xRequestId: 'req-1',
        dataId: '123',
      });

      expect(valido).toBe(false);
      expect(mockValidateSignature).not.toHaveBeenCalled();
    });

    it('deve recusar quando a assinatura é inválida', () => {
      ENV.MERCADO_PAGO_WEBHOOK_SECRET = 'segredo';
      mockValidateSignature.mockImplementationOnce(() => {
        throw new Error('signature mismatch');
      });

      const valido = service.validateWebhookSignature({
        xSignature: 'ts=1,v1=errado',
        xRequestId: 'req-1',
        dataId: '123',
      });

      expect(valido).toBe(false);
    });

    it('deve aceitar quando a assinatura confere', () => {
      ENV.MERCADO_PAGO_WEBHOOK_SECRET = 'segredo';
      mockValidateSignature.mockImplementationOnce(() => undefined);

      const valido = service.validateWebhookSignature({
        xSignature: 'ts=1,v1=ok',
        xRequestId: 'req-1',
        dataId: '123',
      });

      expect(valido).toBe(true);
      expect(mockValidateSignature).toHaveBeenCalledWith(
        expect.objectContaining({ secret: 'segredo', dataId: '123' }),
      );
    });
  });

  describe('createCheckout', () => {
    it('deve falhar quando o token do Mercado Pago não está configurado', async () => {
      const semToken = new MercadoPagoService({
        get: () => undefined,
      } as any);

      await expect(
        semToken.createCheckout({ ...paramsBase, metodo: 'PIX' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deve criar cobrança PIX direta e devolver QR Code e copia-e-cola', async () => {
      mockPaymentCreate.mockResolvedValueOnce({
        id: 123456,
        status: 'pending',
        point_of_interaction: {
          transaction_data: {
            qr_code: '00020126580014br.gov.bcb.pix...',
            qr_code_base64: 'iVBORw0KGgo=',
          },
        },
      });

      const checkout = await service.createCheckout({
        ...paramsBase,
        metodo: 'PIX',
      });

      expect(checkout.tipo).toBe('payment');
      expect(checkout.paymentId).toBe('123456');
      expect(checkout.checkout.pixCopyPaste).toContain('br.gov.bcb.pix');
      expect(checkout.checkout.qrCodeBase64).toBe(
        'data:image/png;base64,iVBORw0KGgo=',
      );
      expect(mockPaymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            payment_method_id: 'pix',
            external_reference: 'reserva-1',
          }),
        }),
      );
    });

    it('deve criar boleto com linha digitável e endereço estruturado do pagador', async () => {
      mockPaymentCreate.mockResolvedValueOnce({
        id: 987654,
        status: 'pending',
        transaction_details: {
          barcode: { content: '23791163900000010503380260601094113400633330' },
          external_resource_url: 'https://www.mercadopago.com.br/sandbox/ticket',
        },
      });

      const checkout = await service.createCheckout({
        ...paramsBase,
        metodo: 'BOLETO',
      });

      expect(checkout.checkout.boletoBarcode).toHaveLength(44);
      expect(checkout.checkout.boletoUrl).toContain('mercadopago.com.br');

      const body = mockPaymentCreate.mock.calls[0][0].body;
      expect(body.payment_method_id).toBe('bolbradesco');
      expect(body.payer.identification).toEqual({
        type: 'CPF',
        number: '12345678909',
      });
      expect(body.payer.address).toEqual(
        expect.objectContaining({
          zip_code: expect.any(String),
          city: expect.any(String),
          federal_unit: expect.any(String),
        }),
      );
    });

    it('deve recusar boleto sem CPF do pagador', async () => {
      await expect(
        service.createCheckout({
          ...paramsBase,
          pagadorCpf: null,
          metodo: 'BOLETO',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(mockPaymentCreate).not.toHaveBeenCalled();
    });

    it('deve criar o checkout de cartão como Preference do Checkout Pro', async () => {
      mockPreferenceCreate.mockResolvedValueOnce({
        id: 'pref-1',
        init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect',
        sandbox_init_point:
          'https://sandbox.mercadopago.com.br/checkout/v1/redirect',
      });

      const checkout = await service.createCheckout({
        ...paramsBase,
        metodo: 'CARTAO',
      });

      expect(checkout.tipo).toBe('preference');
      expect(checkout.checkout.initPoint).toContain('sandbox.mercadopago.com.br');

      const body = mockPreferenceCreate.mock.calls[0][0].body;
      expect(body.external_reference).toBe('reserva-1');
      // PIX e boleto têm fluxo próprio; o checkout de cartão só aceita cartão
      expect(body.payment_methods.excluded_payment_types).toEqual([
        { id: 'bank_transfer' },
        { id: 'ticket' },
      ]);
      // em localhost (http) o MP exige omitir back_urls
      expect(body.back_urls).toBeUndefined();
      expect(body.auto_return).toBeUndefined();
    });

    it('deve converter erro do Mercado Pago em mensagem clara para o app', async () => {
      mockPaymentCreate.mockRejectedValueOnce(
        Object.assign(new Error('internal_error'), { status: 500 }),
      );

      await expect(
        service.createCheckout({ ...paramsBase, metodo: 'PIX' }),
      ).rejects.toThrow(/Tente novamente em instantes/);
    });
  });

  describe('getPayment', () => {
    it('deve expor valor e moeda para a conferência contra o total da reserva', async () => {
      mockPaymentGet.mockResolvedValueOnce({
        id: 123,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: 'reserva-1',
        payment_method_id: 'pix',
        transaction_amount: 331.5,
        currency_id: 'BRL',
      });

      const pagamento = await service.getPayment('123');

      expect(pagamento.transactionAmount).toBe(331.5);
      expect(pagamento.currencyId).toBe('BRL');
    });

    it('deve priorizar o pagamento aprovado ao buscar por external_reference', async () => {
      mockPaymentSearch.mockResolvedValueOnce({
        results: [
          { id: 1, status: 'pending', external_reference: 'reserva-1' },
          {
            id: 2,
            status: 'approved',
            external_reference: 'reserva-1',
            transaction_amount: 331.5,
            currency_id: 'BRL',
          },
        ],
      });

      const pagamento = await service.findPaymentByExternalReference('reserva-1');

      expect(pagamento?.id).toBe('2');
      expect(pagamento?.status).toBe('approved');
    });
  });
});
