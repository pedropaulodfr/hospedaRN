import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePaymentDto } from './dto/pagamento.dto';
import { UploadsService } from '../uploads/uploads.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  MercadoPagoCheckout,
  MercadoPagoCheckoutTipo,
  MercadoPagoService,
} from '../mercado-pago/mercado-pago.service';
import { MetodoPagamento, Prisma } from '@prisma/client';

type DadosPagamento = {
  mpTipo?: MercadoPagoCheckoutTipo;
  mpStatus?: string;
  metodo?: string;
  qrCodeBase64?: string;
  pixCopyPaste?: string;
  boletoBarcode?: string;
  boletoUrl?: string;
  initPoint?: string;
  confirmadoEm?: string;
  atualizadoEm?: string;
  [key: string]: unknown;
};

const STATUS_RESERVA_PAGAVEIS = ['CONFIRMADA', 'AGUARDANDO_PAGAMENTO'];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService,
    private notifications: NotificationsService,
    private mercadoPago: MercadoPagoService,
  ) {}

  async create(dto: CreatePaymentDto) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: dto.reservaId },
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    const existing = await this.prisma.pagamento.findUnique({
      where: { reservaId: dto.reservaId },
    });
    if (existing)
      throw new BadRequestException('Pagamento já existe para esta reserva');

    return this.prisma.pagamento.create({
      data: {
        reservaId: dto.reservaId,
        metodo: dto.metodo,
        valor: reserva.valorTotal,
        codigoTransacao: dto.codigoTransacao,
      },
      include: { reserva: true },
    });
  }

  /**
   * Gera (ou reaproveita) a cobrança no Mercado Pago para uma reserva já
   * confirmada pelo estabelecimento. O comprovante não é usado neste modo: o
   * reconhecimento é automático pelo retorno/webhook do Mercado Pago.
   */
  async createMercadoPagoCheckout(
    reservaId: string,
    metodo: MetodoPagamento,
  ): Promise<{
    paymentId: string;
    metodo: MetodoPagamento;
    mpTipo: MercadoPagoCheckoutTipo;
    checkout: MercadoPagoCheckout['checkout'];
  }> {
    if (!['PIX', 'BOLETO', 'CARTAO'].includes(metodo)) {
      throw new BadRequestException(
        'Método inválido para pagamento Mercado Pago',
      );
    }

    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: {
        hospede: {
          select: {
            id: true,
            nome: true,
            email: true,
            hospede: { select: { cpf: true, endereco: true } },
          },
        },
        estabelecimento: {
          select: { id: true, nome: true, modoPagamento: true },
        },
        pagamento: true,
      },
    });

    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    // O modo é o snapshot gravado na criação da reserva (regra: reservas antigas
    // continuam no modo em que foram criadas).
    const modoPagamento =
      reserva.modoPagamento ?? reserva.estabelecimento.modoPagamento;

    if (modoPagamento !== 'MERCADO_PAGO') {
      throw new BadRequestException(
        'Este estabelecimento não aceita pagamento via Mercado Pago',
      );
    }

    if (reserva.status === 'SOLICITADA') {
      throw new BadRequestException(
        'Aguardando a aprovação do estabelecimento. O pagamento será liberado após a confirmação da reserva.',
      );
    }

    if (['FINALIZADA', 'CANCELADA'].includes(reserva.status)) {
      throw new BadRequestException(
        'Esta reserva não está mais disponível para pagamento',
      );
    }

    if (!STATUS_RESERVA_PAGAVEIS.includes(reserva.status)) {
      throw new BadRequestException(
        `Reserva no status ${reserva.status} não pode ser paga`,
      );
    }

    const existing = reserva.pagamento;
    const existingDados = (existing?.dadosPagamento ?? null) as DadosPagamento | null;

    if (existing?.status === 'CONFIRMADO') {
      throw new BadRequestException(
        'O pagamento desta reserva já foi confirmado pelo Mercado Pago',
      );
    }

    // Reaproveita a cobrança quando o método é o mesmo, evitando gerar QR/boleto
    // novos a cada abertura de tela.
    if (
      existing &&
      existingDados &&
      existingDados.metodo === metodo &&
      existing.codigoTransacao &&
      (existingDados.pixCopyPaste ||
        existingDados.boletoBarcode ||
        existingDados.initPoint)
    ) {
      return {
        paymentId: existing.codigoTransacao,
        metodo: existing.metodo,
        mpTipo: existingDados.mpTipo ?? 'payment',
        checkout: this.toCheckout(existingDados),
      };
    }

    const mpResult = await this.mercadoPago.createCheckout({
      reservaId,
      codigoReserva: reserva.codigoReserva,
      metodo,
      valor: Number(reserva.valorTotal),
      pagadorEmail: reserva.hospede.email,
      pagadorNome: reserva.hospede.nome,
      pagadorCpf: reserva.hospede.hospede?.cpf ?? null,
      pagadorEndereco: reserva.hospede.hospede?.endereco ?? null,
      estabelecimentoNome: reserva.estabelecimento.nome,
    });

    const dadosPagamento: DadosPagamento = {
      mpTipo: mpResult.tipo,
      mpStatus: mpResult.status,
      metodo,
      atualizadoEm: new Date().toISOString(),
      ...(mpResult.checkout.qrCodeBase64
        ? { qrCodeBase64: mpResult.checkout.qrCodeBase64 }
        : {}),
      ...(mpResult.checkout.pixCopyPaste
        ? { pixCopyPaste: mpResult.checkout.pixCopyPaste }
        : {}),
      ...(mpResult.checkout.boletoBarcode
        ? { boletoBarcode: mpResult.checkout.boletoBarcode }
        : {}),
      ...(mpResult.checkout.boletoUrl
        ? { boletoUrl: mpResult.checkout.boletoUrl }
        : {}),
      ...(mpResult.checkout.initPoint
        ? { initPoint: mpResult.checkout.initPoint }
        : {}),
    };

    if (existing) {
      await this.prisma.pagamento.update({
        where: { id: existing.id },
        data: {
          metodo,
          codigoTransacao: mpResult.paymentId,
          status: 'PENDENTE',
          valor: reserva.valorTotal,
          dadosPagamento: this.asJson(dadosPagamento),
        },
      });
    } else {
      await this.prisma.pagamento.create({
        data: {
          reservaId,
          metodo,
          valor: reserva.valorTotal,
          codigoTransacao: mpResult.paymentId,
          status: 'PENDENTE',
          dadosPagamento: this.asJson(dadosPagamento),
        },
      });
    }

    this.logger.log(
      `Checkout Mercado Pago (${metodo}/${mpResult.tipo}) gerado para a reserva ${reserva.codigoReserva} — id ${mpResult.paymentId}`,
    );

    return {
      paymentId: mpResult.paymentId,
      metodo,
      mpTipo: mpResult.tipo,
      checkout: mpResult.checkout,
    };
  }

  /**
   * Webhook do Mercado Pago. Nunca confia no corpo da notificação: consulta o
   * pagamento na API antes de confirmar a reserva.
   */
  async handleMercadoPagoWebhook(params: {
    paymentId: string;
    xSignature?: string | string[] | null;
    xRequestId?: string | string[] | null;
  }) {
    const validSignature = this.mercadoPago.validateWebhookSignature({
      xSignature: params.xSignature,
      xRequestId: params.xRequestId,
      dataId: params.paymentId,
    });

    if (!validSignature) {
      throw new BadRequestException('Assinatura de webhook inválida');
    }

    let mpPayment: Awaited<ReturnType<MercadoPagoService['getPayment']>>;
    try {
      mpPayment = await this.mercadoPago.getPayment(params.paymentId);
    } catch (error: any) {
      const status = error?.status ?? error?.statusCode;

      // Pagamento inexistente: nada a reconciliar, e reenviar não resolve.
      if (status === 404) {
        this.logger.warn(
          `Pagamento MP ${params.paymentId} não encontrado — notificação ignorada`,
        );
        return { processed: false, reason: 'not-found' };
      }

      this.logger.error(
        `Falha ao consultar pagamento MP ${params.paymentId}: ${String(error)}`,
      );
      // Erro de infraestrutura: devolve 5xx para o Mercado Pago reenviar a
      // notificação (200 com processed:false faria a cobrança ser perdida).
      throw new ServiceUnavailableException(
        'Não foi possível consultar o pagamento no Mercado Pago agora',
      );
    }

    if (mpPayment.status !== 'approved') {
      this.logger.log(
        `Pagamento MP ${params.paymentId} com status '${mpPayment.status}' — aguardando aprovação`,
      );
      return { processed: false, reason: 'not-approved' };
    }

    const reservaId = mpPayment.externalReference;
    if (!reservaId) {
      this.logger.error(
        `Pagamento MP ${params.paymentId} sem external_reference`,
      );
      return { processed: false, reason: 'missing-reference' };
    }

    const processed = await this.confirmarPagamentoMercadoPago(reservaId, {
      id: mpPayment.id,
      status: mpPayment.status,
      statusDetail: mpPayment.statusDetail,
      metodoId: mpPayment.paymentMethodId,
      transactionAmount: mpPayment.transactionAmount,
      currencyId: mpPayment.currencyId,
    });

    return { processed };
  }

  /**
   * Sincronização sob demanda: usada quando o webhook não alcança o servidor
   * (ex.: desenvolvimento local). Consulta o Mercado Pago e, se aprovado,
   * reconhece o pagamento exatamente como o webhook faria.
   */
  async syncMercadoPagoPayment(
    reservaId: string,
    userId: string,
    userRole: string,
  ) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: {
        estabelecimento: {
          select: { id: true, modoPagamento: true, proprietarioId: true },
        },
        pagamento: true,
      },
    });

    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    const isHospede = reserva.hospedeId === userId;
    const isOwner = reserva.estabelecimento.proprietarioId === userId;
    if (!isHospede && !isOwner && userRole !== 'ADMIN') {
      throw new ForbiddenException('Sem permissão para consultar esta reserva');
    }

    const modoPagamento =
      reserva.modoPagamento ?? reserva.estabelecimento.modoPagamento;
    if (modoPagamento !== 'MERCADO_PAGO') {
      return { status: 'NAO_APLICA' as const };
    }

    const pagamento = reserva.pagamento;
    if (!pagamento || !pagamento.codigoTransacao) {
      return { status: 'SEM_COBRANCA' as const };
    }
    if (pagamento.status === 'CONFIRMADO') {
      return { status: 'CONFIRMADO' as const };
    }

    const dados = (pagamento.dadosPagamento ?? {}) as DadosPagamento;
    const mpTipo: MercadoPagoCheckoutTipo = dados.mpTipo ?? 'payment';

    const mpPayment =
      mpTipo === 'preference'
        ? await this.mercadoPago.findPaymentByExternalReference(reservaId)
        : await this.mercadoPago
            .getPayment(pagamento.codigoTransacao)
            .catch(() => null);

    if (!mpPayment) {
      return { status: pagamento.status, mpStatus: 'not_found' as const };
    }

    if (mpPayment.status !== 'approved') {
      await this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          dadosPagamento: {
            ...dados,
            mpStatus: mpPayment.status ?? undefined,
            atualizadoEm: new Date().toISOString(),
          },
        },
      });
      return { status: pagamento.status, mpStatus: mpPayment.status };
    }

    await this.confirmarPagamentoMercadoPago(reservaId, {
      id: mpPayment.id,
      status: mpPayment.status,
      statusDetail: mpPayment.statusDetail,
      metodoId: mpPayment.paymentMethodId,
      transactionAmount: mpPayment.transactionAmount,
      currencyId: mpPayment.currencyId,
    });

    return { status: 'CONFIRMADO' as const, mpStatus: 'approved' as const };
  }

  /**
   * Rotina de reconciliação: varre os pagamentos Mercado Pago ainda pendentes e
   * confirma automaticamente os que já foram aprovados na plataforma.
   *
   * Existe porque o reconhecimento não pode depender do navegador do hóspede:
   * se o webhook não chegar (URL pública/secret ausentes) e o hóspede fechar a
   * página depois de pagar, a reserva ficaria "aguardando pagamento" para
   * sempre. Como o `confirmarPagamentoMercadoPago` é idempotente e confere
   * valor/moeda, rodar isso em paralelo ao webhook é seguro.
   */
  async reconciliarMercadoPagoPendentes(
    opcoes: { lote?: number; janelaHoras?: number } = {},
  ) {
    const inicio = Date.now();
    const lote = Math.min(Math.max(opcoes.lote ?? 25, 1), 100);
    const janelaHoras = Math.min(
      Math.max(opcoes.janelaHoras ?? 72, 1),
      24 * 30,
    );

    if (!this.mercadoPago.accessToken) {
      return {
        habilitado: false as const,
        motivo: 'MERCADO_PAGO_ACCESS_TOKEN não configurado',
        verificados: 0,
        confirmados: 0,
        pendentes: 0,
        semResposta: 0,
        jaTratados: 0,
        erros: 0,
        duracaoMs: Date.now() - inicio,
      };
    }

    const desde = new Date(Date.now() - janelaHoras * 3_600_000);

    const candidatos = await this.prisma.pagamento.findMany({
      where: {
        status: 'PENDENTE',
        criadoEm: { gte: desde },
        reserva: {
          status: { in: ['CONFIRMADA', 'AGUARDANDO_PAGAMENTO'] },
          OR: [
            { modoPagamento: 'MERCADO_PAGO' },
            { estabelecimento: { modoPagamento: 'MERCADO_PAGO' } },
          ],
        },
      },
      select: {
        id: true,
        reservaId: true,
        codigoTransacao: true,
        dadosPagamento: true,
        criadoEm: true,
      },
      orderBy: { criadoEm: 'asc' },
      take: lote,
    });

    const resumo = {
      habilitado: true as const,
      verificados: 0,
      confirmados: 0,
      pendentes: 0,
      semResposta: 0,
      jaTratados: 0,
      erros: 0,
    };

    for (const pagamento of candidatos) {
      const dados = (pagamento.dadosPagamento ?? null) as DadosPagamento | null;
      if (!dados || !pagamento.codigoTransacao) {
        // Pagamento manual (modo PADRAO) ou cobrança sem dados: nada a consultar.
        continue;
      }

      resumo.verificados += 1;
      const mpTipo: MercadoPagoCheckoutTipo = dados.mpTipo ?? 'payment';

      try {
        const mpPayment =
          mpTipo === 'preference'
            ? await this.mercadoPago.findPaymentByExternalReference(
                pagamento.reservaId,
              )
            : await this.mercadoPago
                .getPayment(pagamento.codigoTransacao)
                .catch(() => null);

        if (!mpPayment) {
          resumo.semResposta += 1;
          continue;
        }

        if (mpPayment.status === 'approved') {
          const confirmou = await this.confirmarPagamentoMercadoPago(
            pagamento.reservaId,
            {
              id: mpPayment.id,
              status: mpPayment.status,
              statusDetail: mpPayment.statusDetail,
              metodoId: mpPayment.paymentMethodId,
              transactionAmount: mpPayment.transactionAmount,
              currencyId: mpPayment.currencyId,
            },
          );

          if (confirmou) {
            resumo.confirmados += 1;
          } else {
            resumo.jaTratados += 1;
          }
          continue;
        }

        resumo.pendentes += 1;

        // Guarda o último status conhecido (bom para suporte), sem reescrever
        // o JSON a cada ciclo quando nada mudou.
        if (mpPayment.status && mpPayment.status !== dados.mpStatus) {
          await this.prisma.pagamento.update({
            where: { id: pagamento.id },
            data: {
              dadosPagamento: this.asJson({
                ...dados,
                mpStatus: mpPayment.status,
                atualizadoEm: new Date().toISOString(),
              }),
            },
          });
        }
      } catch (error) {
        resumo.erros += 1;
        this.logger.error(
          `Reconciliação MP falhou na reserva ${pagamento.reservaId} (pagamento ${pagamento.id}): ${String(error)}`,
        );
      }
    }

    const duracaoMs = Date.now() - inicio;
    const resultado = { ...resumo, duracaoMs };

    if (resumo.confirmados > 0 || resumo.erros > 0) {
      this.logger.log(
        `Reconciliação MP: ${resumo.verificados} verificados, ${resumo.confirmados} confirmados, ${resumo.pendentes} pendentes, ${resumo.erros} erros (${duracaoMs}ms)`,
      );
    } else {
      this.logger.debug(
        `Reconciliação MP: ${resumo.verificados} verificados, nenhuma confirmação (${duracaoMs}ms)`,
      );
    }

    return resultado;
  }

  /**
   * Reconhecimento automático: marca o pagamento como CONFIRMADO e finaliza a
   * reserva, sem nenhuma ação humana. Idempotente.
   */
  private async confirmarPagamentoMercadoPago(
    reservaId: string,
    mpPayment: {
      id: string;
      status?: string | null;
      statusDetail?: string | null;
      metodoId?: string | null;
      transactionAmount?: number | null;
      currencyId?: string | null;
    },
  ): Promise<boolean> {
    const pagamento = await this.prisma.pagamento.findUnique({
      where: { reservaId },
      include: {
        reserva: {
          include: {
            hospede: { select: { id: true, nome: true, email: true } },
            estabelecimento: {
              select: {
                id: true,
                nome: true,
                emailContato: true,
                proprietario: { select: { email: true } },
              },
            },
          },
        },
      },
    });

    if (!pagamento) {
      this.logger.warn(`Nenhum pagamento encontrado para a reserva ${reservaId}`);
      return false;
    }

    if (pagamento.status === 'CONFIRMADO') {
      this.logger.log(`Pagamento ${pagamento.id} já confirmado — ignorado`);
      return false;
    }

    const reserva = pagamento.reserva;
    const dados = (pagamento.dadosPagamento ?? {}) as DadosPagamento;
    const dadosAtualizados: DadosPagamento = {
      ...dados,
      mpStatus: mpPayment.status ?? 'approved',
      mpPaymentId: mpPayment.id,
      mpStatusDetail: mpPayment.statusDetail ?? undefined,
      metodoId: mpPayment.metodoId ?? undefined,
      confirmadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    // Nunca confia no valor informado pelo cliente: confere com o total gravado.
    const valorEsperado = Number(reserva.valorTotal);
    const valorPago = mpPayment.transactionAmount;
    const moeda = mpPayment.currencyId ?? 'BRL';
    const valorDivergente =
      typeof valorPago === 'number' && Math.abs(valorPago - valorEsperado) > 0.01;

    if (valorDivergente || moeda !== 'BRL') {
      this.logger.error(
        `Pagamento MP ${mpPayment.id} inconsistente para a reserva ${reserva.codigoReserva}: pago=${valorPago} ${moeda}, esperado=${valorEsperado} BRL — reserva NÃO finalizada`,
      );
      await this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          dadosPagamento: this.asJson({
            ...dadosAtualizados,
            inconsistencia: {
              valorPago: valorPago ?? null,
              moeda,
              valorEsperado,
              detectadaEm: new Date().toISOString(),
            },
          }),
        },
      });
      return false;
    }

    const deveFinalizar = ['CONFIRMADA', 'AGUARDANDO_PAGAMENTO'].includes(
      reserva.status,
    );

    // Idempotência otimista: só o primeiro a transicionar de PENDENTE para
    // CONFIRMADO executa os efeitos colaterais (e-mail, finalização).
    const confirmou = await this.prisma.$transaction(async (tx) => {
      const ganhou = await tx.pagamento.updateMany({
        where: { id: pagamento.id, status: { not: 'CONFIRMADO' } },
        data: {
          status: 'CONFIRMADO',
          codigoTransacao: mpPayment.id,
          dadosPagamento: this.asJson(dadosAtualizados),
        },
      });

      if (ganhou.count !== 1) return false;

      if (deveFinalizar) {
        await tx.reserva.update({
          where: { id: reservaId },
          data: { status: 'FINALIZADA' },
        });
      }

      return true;
    });

    if (!confirmou) {
      this.logger.log(
        `Pagamento ${pagamento.id} já confirmado por outra via — ignorado`,
      );
      return false;
    }

    if (!deveFinalizar) {
      this.logger.warn(
        `Pagamento aprovado para a reserva ${reserva.codigoReserva}, mas a reserva está em ${reserva.status} — status da reserva mantido (verificar reembolso).`,
      );
    }

    this.logger.log(
      `Pagamento MP ${mpPayment.id} aprovado — reserva ${reserva.codigoReserva} reconhecida automaticamente`,
    );

    const contexto = {
      nome: reserva.hospede.nome,
      codigoReserva: reserva.codigoReserva,
      estabelecimento: reserva.estabelecimento.nome,
      checkIn: reserva.checkIn.toISOString().split('T')[0],
      checkOut: reserva.checkOut.toISOString().split('T')[0],
    };

    this.notifications
      .sendPaymentMercadoPagoConfirmed({
        email: reserva.hospede.email,
        ...contexto,
      })
      .catch(() => {});

    const emailEstabelecimento =
      reserva.estabelecimento.emailContato ||
      reserva.estabelecimento.proprietario?.email;

    if (emailEstabelecimento) {
      this.notifications
        .sendPaymentMercadoPagoConfirmedToEstablishment({
          email: emailEstabelecimento,
          ...contexto,
        })
        .catch(() => {});
    }

    return true;
  }

  private asJson(value: DadosPagamento): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }

  private toCheckout(dados: DadosPagamento): MercadoPagoCheckout['checkout'] {
    return {
      qrCodeBase64: dados.qrCodeBase64,
      pixCopyPaste: dados.pixCopyPaste,
      boletoBarcode: dados.boletoBarcode,
      boletoUrl: dados.boletoUrl,
      initPoint: dados.initPoint,
    };
  }

  async uploadComprovante(
    paymentId: string,
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ) {
    const pagamentoExistente = await this.prisma.pagamento.findUnique({
      where: { id: paymentId },
      include: {
        reserva: {
          select: {
            modoPagamento: true,
            estabelecimento: {
              select: { id: true, modoPagamento: true },
            },
          },
        },
      },
    });

    if (
      pagamentoExistente?.reserva?.modoPagamento === 'MERCADO_PAGO' ||
      pagamentoExistente?.reserva?.estabelecimento?.modoPagamento ===
        'MERCADO_PAGO'
    ) {
      throw new ForbiddenException(
        'Este estabelecimento não aceita comprovante manual. O pagamento é reconhecido automaticamente via Mercado Pago.',
      );
    }

    const result = await this.uploads.uploadFile(
      buffer,
      filename,
      mimetype,
      'comprovantes',
    );
    const pagamento = await this.prisma.pagamento.update({
      where: { id: paymentId },
      data: {
        comprovanteUrl: result.url,
        comprovanteS3Key: result.s3Key,
        status: 'CONFIRMADO',
      },
      include: {
        reserva: {
          include: {
            hospede: { select: { id: true, nome: true, email: true } },
            estabelecimento: { select: { id: true, nome: true } },
          },
        },
      },
    });

    this.notifications
      .sendPaymentUploaded({
        email: pagamento.reserva.hospede.email,
        nome: pagamento.reserva.hospede.nome,
        codigoReserva: pagamento.reserva.codigoReserva,
        estabelecimento: pagamento.reserva.estabelecimento.nome,
      })
      .catch(() => {});

    return pagamento;
  }

  async confirm(paymentId: string) {
    const pagamentoExistente = await this.prisma.pagamento.findUnique({
      where: { id: paymentId },
      include: {
        reserva: {
          select: {
            modoPagamento: true,
            estabelecimento: {
              select: { modoPagamento: true },
            },
          },
        },
      },
    });

    if (
      pagamentoExistente?.reserva?.modoPagamento === 'MERCADO_PAGO' ||
      pagamentoExistente?.reserva?.estabelecimento?.modoPagamento ===
        'MERCADO_PAGO'
    ) {
      throw new ForbiddenException(
        'Este estabelecimento utiliza pagamento automático via Mercado Pago.',
      );
    }

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { id: paymentId },
    });
    if (!pagamento) throw new NotFoundException('Pagamento não encontrado');

    const reserva = await this.prisma.reserva.update({
      where: { id: pagamento.reservaId },
      data: { status: 'AGUARDANDO_PAGAMENTO' },
      include: {
        hospede: { select: { id: true, nome: true, email: true } },
        estabelecimento: { select: { id: true, nome: true } },
      },
    });

    const updated = await this.prisma.pagamento.update({
      where: { id: paymentId },
      data: { status: 'CONFIRMADO' },
    });

    this.notifications
      .sendPaymentConfirmed({
        email: reserva.hospede.email,
        nome: reserva.hospede.nome,
        codigoReserva: reserva.codigoReserva,
        estabelecimento: reserva.estabelecimento.nome,
        checkIn: reserva.checkIn.toISOString().split('T')[0],
        checkOut: reserva.checkOut.toISOString().split('T')[0],
      })
      .catch(() => {});

    return updated;
  }

  async findByReservation(reservaId: string) {
    return this.prisma.pagamento.findUnique({
      where: { reservaId },
      include: {
        reserva: {
          include: {
            hospede: { select: { id: true, nome: true } },
            estabelecimento: {
              select: { id: true, nome: true, modoPagamento: true },
            },
          },
        },
      },
    });
  }

  async getMercadoPagoCheckout(reservaId: string) {
    const pagamento = await this.prisma.pagamento.findUnique({
      where: { reservaId },
      select: {
        codigoTransacao: true,
        metodo: true,
        status: true,
        dadosPagamento: true,
      },
    });
    if (!pagamento?.dadosPagamento) {
      throw new NotFoundException(
        'Checkout não encontrado. Gere o pagamento primeiro.',
      );
    }
    const dados = pagamento.dadosPagamento as DadosPagamento;
    return {
      paymentId: pagamento.codigoTransacao,
      metodo: pagamento.metodo,
      status: pagamento.status,
      mpTipo: dados.mpTipo ?? 'payment',
      checkout: this.toCheckout(dados),
    };
  }

  async generatePix(reservaId: string) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');
    return {
      pixKey: 'hospedarn@hospedarn.com.br',
      pixType: 'EMAIL',
      valor: reserva.valorTotal,
      codigoReserva: reserva.codigoReserva,
      qrCode: 'data:image/png;base64,PLACEHOLDER_QR_CODE',
      pixCopyPaste:
        '0020126580014br.gov.bcb.pix0136hospedarn@hospedarn.com.br5204000053039865802BR5913HospedaRN6008Natal, RN62070503***6304',
    };
  }
}
