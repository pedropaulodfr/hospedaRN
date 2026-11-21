import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, {
  Payment,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';
import { MetodoPagamento } from '@prisma/client';

export type MercadoPagoCheckoutTipo = 'payment' | 'preference';

export interface MercadoPagoCheckout {
  metodo: MetodoPagamento;
  paymentId: string;
  /** 'payment' = cobrança direta (PIX/boleto); 'preference' = Checkout Pro (cartão) */
  tipo: MercadoPagoCheckoutTipo;
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
  pagadorCpf?: string | null;
  pagadorEndereco?: string | null;
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

  get publicKey(): string | undefined {
    return this.config.get<string>('MERCADO_PAGO_PUBLIC_KEY');
  }

  private get notificationUrl(): string | undefined {
    const url = this.config.get<string>('MERCADO_PAGO_NOTIFICATION_URL')?.trim();
    return url ? url : undefined;
  }

  async createCheckout(
    params: CreateMercadoPagoCheckoutParams,
  ): Promise<MercadoPagoCheckout> {
    if (!this.accessToken) {
      throw new BadRequestException(
        'Mercado Pago não configurado. Informe MERCADO_PAGO_ACCESS_TOKEN.',
      );
    }
    if (!(params.valor > 0)) {
      throw new BadRequestException(
        'Valor da reserva inválido para gerar o pagamento.',
      );
    }

    if (params.metodo === 'CARTAO') {
      return this.createCardPreference(params);
    }
    return this.createDirectPayment(params);
  }

  /**
   * PIX e boleto são criados como cobrança direta (`/v1/payments`), o que devolve
   * o QR Code PIX / linha digitável reais gerados pelo Mercado Pago.
   */
  private async createDirectPayment(
    params: CreateMercadoPagoCheckoutParams,
  ): Promise<MercadoPagoCheckout> {
    const isBoleto = params.metodo === 'BOLETO';
    const payer = this.buildPayer(params, isBoleto);

    // Chave de idempotência em janelas de 10 min: evita cobrança duplicada por
    // clique duplo, mas permite gerar uma nova cobrança depois (ex.: expirada).
    const idempotencyKey = `${params.reservaId}-${params.metodo}-${Math.floor(
      Date.now() / 600_000,
    )}`;

    const result = await this.executarNoMercadoPago('criação do pagamento', () =>
      this.paymentClient.create({
        body: {
          transaction_amount: params.valor,
          description: `Reserva ${params.codigoReserva} - ${params.estabelecimentoNome}`,
          payment_method_id: isBoleto ? 'bolbradesco' : 'pix',
          payer,
          external_reference: params.reservaId,
          notification_url: this.notificationUrl,
          metadata: {
            reserva_id: params.reservaId,
            codigo_reserva: params.codigoReserva,
          },
        },
        requestOptions: { idempotencyKey },
      }),
    );

    const checkout: MercadoPagoCheckout['checkout'] = {};
    if (isBoleto) {
      checkout.boletoBarcode = result.transaction_details?.barcode?.content;
      checkout.boletoUrl =
        result.transaction_details?.external_resource_url ?? undefined;
    } else {
      checkout.qrCodeBase64 = this.normalizeQrBase64(
        result.point_of_interaction?.transaction_data?.qr_code_base64,
      );
      checkout.pixCopyPaste =
        result.point_of_interaction?.transaction_data?.qr_code;
    }

    if (!checkout.pixCopyPaste && !checkout.boletoBarcode) {
      this.logger.warn(
        `Mercado Pago retornou pagamento ${result.id} sem dados de checkout (${params.metodo}).`,
      );
    }

    return {
      metodo: params.metodo,
      paymentId: String(result.id),
      tipo: 'payment',
      status: result.status ?? 'pending',
      checkout,
    };
  }

  /**
   * Cartão é feito pelo Checkout Pro: o hóspede paga no ambiente do Mercado
   * Pago, então nenhum dado de cartão passa pelo nosso servidor.
   */
  private async createCardPreference(
    params: CreateMercadoPagoCheckoutParams,
  ): Promise<MercadoPagoCheckout> {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const successUrl = `${frontendUrl.replace(/\/+$/, '')}/hospede/reservas`;

    // O Mercado Pago exige back_urls https. Em desenvolvimento (localhost) elas
    // são omitidas — junto com auto_return, que depende delas.
    const isHttpsFrontend = successUrl.startsWith('https://');
    const backUrls = isHttpsFrontend
      ? { success: successUrl, failure: successUrl, pending: successUrl }
      : undefined;

    const preference = await this.executarNoMercadoPago(
      'criação do checkout de cartão',
      () =>
        this.preferenceClient.create({
          body: {
            items: [
              {
                id: params.reservaId,
                title: `Reserva ${params.codigoReserva} - ${params.estabelecimentoNome}`,
                quantity: 1,
                unit_price: params.valor,
                currency_id: 'BRL',
              },
            ],
            payer: {
              email: params.pagadorEmail,
              name: params.pagadorNome,
            },
            external_reference: params.reservaId,
            notification_url: this.notificationUrl,
            back_urls: backUrls,
            auto_return: backUrls ? 'approved' : undefined,
            payment_methods: {
              // Apenas cartões: PIX e boleto têm fluxo próprio (cobrança direta).
              excluded_payment_types: [{ id: 'bank_transfer' }, { id: 'ticket' }],
            },
            metadata: {
              reserva_id: params.reservaId,
              codigo_reserva: params.codigoReserva,
            },
          },
        }),
    );

    const initPoint = preference.sandbox_init_point || preference.init_point;
    if (!initPoint) {
      throw new BadRequestException(
        'Mercado Pago não retornou a URL de checkout do cartão.',
      );
    }

    return {
      metodo: params.metodo,
      paymentId: String(preference.id),
      tipo: 'preference',
      status: 'pending',
      checkout: { initPoint },
    };
  }

  async getPayment(paymentId: string) {
    const payment = await this.paymentClient.get({ id: paymentId });
    return {
      id: String(payment.id),
      status: payment.status,
      statusDetail: payment.status_detail,
      externalReference: payment.external_reference,
      paymentMethodId: payment.payment_method_id,
      transactionAmount: payment.transaction_amount,
      currencyId: payment.currency_id,
    };
  }

  /**
   * Busca o pagamento mais recente de uma reserva pelo `external_reference`.
   * Necessário porque no cartão (Checkout Pro) o id salvo é o da preference,
   * não o do pagamento.
   */
  async findPaymentByExternalReference(externalReference: string) {
    try {
      const result = await this.paymentClient.search({
        options: {
          external_reference: externalReference,
          sort: 'date_created',
          criteria: 'desc',
          limit: 10,
        },
      });
      const results = result.results ?? [];
      const approved = results.find((item) => item.status === 'approved');
      const chosen = approved ?? results[0];
      if (!chosen) return null;
      return {
        id: String(chosen.id),
        status: chosen.status,
        statusDetail: chosen.status_detail,
        externalReference: chosen.external_reference,
        paymentMethodId: chosen.payment_method_id,
        transactionAmount: chosen.transaction_amount,
        currencyId: chosen.currency_id,
      };
    } catch (error) {
      this.logger.error(
        `Falha ao buscar pagamentos do Mercado Pago (ref=${externalReference}): ${String(
          error,
        )}`,
      );
      return null;
    }
  }

  validateWebhookSignature(options: {
    xSignature: string | string[] | undefined | null;
    xRequestId: string | string[] | undefined | null;
    dataId: string | string[] | undefined | null;
  }): boolean {
    const secret = this.config.get<string>('MERCADO_PAGO_WEBHOOK_SECRET');
    if (!secret) {
      // Fail-closed: sem segredo configurado não há como provar a origem da
      // notificação. Em produção isso é erro de configuração; em desenvolvimento
      // a sincronização (POST /pagamentos/reserva/:id/sincronizar) cobre o fluxo.
      const mensagem =
        'MERCADO_PAGO_WEBHOOK_SECRET não configurado — webhook recusado';
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.error(mensagem);
      } else {
        this.logger.warn(mensagem);
      }
      return false;
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

  /**
   * Converte falhas do Mercado Pago em respostas claras para o app: erro de
   * dados (400/422) vira 400 com a mensagem do gateway; indisponibilidade vira
   * 502 sem vazar detalhes internos.
   */
  private async executarNoMercadoPago<T>(
    operacao: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status ?? error?.statusCode;
      const detalhe = String(error?.message ?? error);
      this.logger.error(
        `Mercado Pago — ${operacao} falhou (status ${status ?? 'n/a'}): ${detalhe}`,
      );

      if (status === 401 || status === 403) {
        throw new BadRequestException(
          'Credenciais do Mercado Pago inválidas. Verifique MERCADO_PAGO_ACCESS_TOKEN.',
        );
      }
      if (status === 400 || status === 422) {
        throw new BadRequestException(
          `O Mercado Pago recusou os dados do pagamento: ${detalhe}`,
        );
      }
      throw new BadGatewayException(
        'Não foi possível gerar o pagamento no Mercado Pago agora. Tente novamente em instantes.',
      );
    }
  }

  private buildPayer(
    params: CreateMercadoPagoCheckoutParams,
    requireStructuredAddress: boolean,
  ) {
    const nomeCompleto = (params.pagadorNome ?? '').trim();
    const [firstName, ...rest] = nomeCompleto.split(/\s+/);
    const lastName = rest.join(' ') || firstName || 'Hóspede';
    const cpf = (params.pagadorCpf ?? '').replace(/\D/g, '');

    if (requireStructuredAddress && cpf.length !== 11) {
      throw new BadRequestException(
        'O CPF do hóspede é obrigatório para gerar boleto no Mercado Pago.',
      );
    }

    const payer: Record<string, unknown> = {
      email: params.pagadorEmail,
      first_name: firstName || 'Hóspede',
      last_name: lastName,
    };

    if (cpf.length === 11) {
      payer.identification = { type: 'CPF', number: cpf };
    }

    if (requireStructuredAddress) {
      payer.address = this.buildBoletoAddress(params);
    }

    return payer;
  }

  /**
   * O boleto registrado do Mercado Pago exige endereço completo do pagador.
   * O cadastro de hóspede só guarda o endereço em texto livre, então os campos
   * estruturados vêm de configuração (com fallback) e o texto livre é usado
   * como logradouro quando existir.
   */
  private buildBoletoAddress(params: CreateMercadoPagoCheckoutParams) {
    const read = (key: string, fallback: string) =>
      this.config.get<string>(key)?.trim() || fallback;

    const ruaDoHospede = (params.pagadorEndereco ?? '').trim();
    return {
      zip_code: read('MERCADO_PAGO_PAYER_ZIP_CODE', '59000000').replace(
        /\D/g,
        '',
      ),
      street_name: read(
        'MERCADO_PAGO_PAYER_STREET_NAME',
        ruaDoHospede || 'Rua da Integracao',
      ).slice(0, 120),
      street_number: read('MERCADO_PAGO_PAYER_STREET_NUMBER', 'SN'),
      neighborhood: read('MERCADO_PAGO_PAYER_NEIGHBORHOOD', 'Centro'),
      city: read('MERCADO_PAGO_PAYER_CITY', 'Natal'),
      federal_unit: read('MERCADO_PAGO_PAYER_FEDERAL_UNIT', 'RN').slice(0, 2),
    };
  }

  private normalizeQrBase64(value?: string): string | undefined {
    if (!value) return undefined;
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
  }
}
