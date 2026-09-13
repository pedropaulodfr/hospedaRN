import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, {
  Payment,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';
import { MetodoPagamento } from '@prisma/client';

export interface MercadoPagoCheckout {
  metodo: MetodoPagamento;
  paymentId: string;
  status: string;
  checkout: {
    qrCodeBase64?: string;
    pixCopyPaste?: string;
    boletoBarcode?: string;
    boletoUrl?: string;
    initPoint?: string;
  };
}

export interface CreateMercadoPagoCheckoutParams {
  reservaId: string;
  codigoReserva: string;
  metodo: MetodoPagamento;
  valor: number;
  pagadorEmail: string;
  pagadorNome: string;
  estabelecimentoNome: string;
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly paymentClient: Payment;
  private readonly preferenceClient: Preference;

  constructor(private readonly config: ConfigService) {
    const mpConfig = new MercadoPagoConfig({
      accessToken: this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN') ?? '',
    });
    this.paymentClient = new Payment(mpConfig);
    this.preferenceClient = new Preference(mpConfig);
  }

  get accessToken(): string | undefined {
    return this.config.get<string>('MERCADO_PAGO_ACCESS_TOKEN');
  }

  async createCheckout(
    params: CreateMercadoPagoCheckoutParams,
  ): Promise<MercadoPagoCheckout> {
    if (!this.accessToken) {
      throw new BadRequestException(
        'Mercado Pago não configurado. Informe MERCADO_PAGO_ACCESS_TOKEN.',
      );
    }

    const notificationUrl =
      this.config.get<string>('MERCADO_PAGO_NOTIFICATION_URL') || undefined;
    const externalReference = params.reservaId;
    const description = `Reserva ${params.codigoReserva} - ${params.estabelecimentoNome}`;

    if (params.metodo === 'PIX' || params.metodo === 'BOLETO') {
      const paymentMethodId = params.metodo === 'PIX' ? 'pix' : 'bolbradesco';

      const result = await this.paymentClient.create({
        body: {
          transaction_amount: params.valor,
          description,
          payment_method_id: paymentMethodId,
          payer: {
            email: params.pagadorEmail,
            first_name: params.pagadorNome,
          },
          external_reference: externalReference,
          notification_url: notificationUrl,
        },
      });

      const checkout: MercadoPagoCheckout['checkout'] = {};
      if (params.metodo === 'PIX') {
        checkout.qrCodeBase64 =
          result.point_of_interaction?.transaction_data?.qr_code_base64;
        checkout.pixCopyPaste =
          result.point_of_interaction?.transaction_data?.qr_code;
      } else {
        checkout.boletoBarcode = result.transaction_details?.barcode?.content;
        checkout.boletoUrl = result.transaction_details?.external_resource_url;
      }

      return {
        metodo: params.metodo,
        paymentId: String(result.id),
        status: result.status ?? 'pending',
        checkout,
      };
    }

    const successUrl = `${
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
    }/hospede/reservas`;

    const preference = await this.preferenceClient.create({
      body: {
        items: [
          {
            id: params.reservaId,
            title: description,
            quantity: 1,
            unit_price: params.valor,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: params.pagadorEmail,
          name: params.pagadorNome,
        },
        external_reference: externalReference,
        notification_url: notificationUrl,
        auto_return: 'approved',
        back_urls: {
          success: successUrl,
          failure: successUrl,
          pending: successUrl,
        },
      },
    });

    return {
      metodo: MetodoPagamento.CARTAO,
      paymentId: preference.id ?? '',
      status: 'pending',
      checkout: { initPoint: preference.init_point },
    };
  }

  async getPayment(paymentId: string) {
    const payment = await this.paymentClient.get({ id: paymentId });
    return {
      id: String(payment.id),
      status: payment.status,
      externalReference: payment.external_reference,
      paymentMethodId: payment.payment_method_id,
      transactionAmount: payment.transaction_amount,
    };
  }

  validateWebhookSignature(options: {
    xSignature: string | string[] | undefined | null;
    xRequestId: string | string[] | undefined | null;
    dataId: string | string[] | undefined | null;
  }): boolean {
    const secret = this.config.get<string>('MERCADO_PAGO_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('MERCADO_PAGO_WEBHOOK_SECRET não configurado');
      return true;
    }
    try {
      WebhookSignatureValidator.validate({
        xSignature: options.xSignature,
        xRequestId: options.xRequestId,
        dataId: options.dataId,
        secret,
      });
      return true;
    } catch (error) {
      this.logger.error(`Webhook MP inválido: ${String(error)}`);
      return false;
    }
  }
}