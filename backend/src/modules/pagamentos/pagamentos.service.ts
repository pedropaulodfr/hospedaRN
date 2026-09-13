import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePaymentDto } from './dto/pagamento.dto';
import { UploadsService } from '../uploads/uploads.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MercadoPagoService } from '../mercado-pago/mercado-pago.service';
import { MetodoPagamento } from '@prisma/client';

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
    const reserva = await this.prisma.reserva.findUnique({ where: { id: dto.reservaId } });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    const existing = await this.prisma.pagamento.findUnique({ where: { reservaId: dto.reservaId } });
    if (existing) throw new BadRequestException('Pagamento já existe para esta reserva');

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

  async createMercadoPagoCheckout(reservaId: string, metodo: MetodoPagamento) {
    if (metodo !== 'PIX' && metodo !== 'BOLETO' && metodo !== 'CARTAO') {
      throw new BadRequestException('Método inválido para pagamento Mercado Pago');
    }

    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      include: {
        hospede: { select: { id: true, nome: true, email: true } },
        estabelecimento: {
          select: { id: true, nome: true, modoPagamento: true },
        },
      },
    });

    if (!reserva) throw new NotFoundException('Reserva não encontrada');

    if (reserva.estabelecimento.modoPagamento !== 'MERCADO_PAGO') {
      throw new BadRequestException(
        'Este estabelecimento não aceita pagamento via Mercado Pago',
      );
    }

    const existing = await this.prisma.pagamento.findUnique({
      where: { reservaId },
    });

    if (existing && existing.dadosPagamento) {
      return {
        paymentId: existing.codigoTransacao,
        metodo: existing.metodo,
        checkout: existing.dadosPagamento as Record<string, string>,
      };
    }

    const mpResult = await this.mercadoPago.createCheckout({
      reservaId,
      codigoReserva: reserva.codigoReserva,
      metodo,
      valor: Number(reserva.valorTotal),
      pagadorEmail: reserva.hospede.email,
      pagadorNome: reserva.hospede.nome,
      estabelecimentoNome: reserva.estabelecimento.nome,
    });

    const dadosPagamento: Record<string, string> = {};
    if (mpResult.checkout.qrCodeBase64) dadosPagamento.qrCodeBase64 = mpResult.checkout.qrCodeBase64;
    if (mpResult.checkout.pixCopyPaste) dadosPagamento.pixCopyPaste = mpResult.checkout.pixCopyPaste;
    if (mpResult.checkout.boletoBarcode) dadosPagamento.boletoBarcode = mpResult.checkout.boletoBarcode;
    if (mpResult.checkout.boletoUrl) dadosPagamento.boletoUrl = mpResult.checkout.boletoUrl;
    if (mpResult.checkout.initPoint) dadosPagamento.initPoint = mpResult.checkout.initPoint;

    if (existing) {
      await this.prisma.pagamento.update({
        where: { id: existing.id },
        data: {
          codigoTransacao: mpResult.paymentId,
          status: 'PENDENTE',
          dadosPagamento,
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
          dadosPagamento,
        },
      });
    }

    return {
      paymentId: mpResult.paymentId,
      metodo: mpResult.metodo,
      checkout: mpResult.checkout,
    };
  }

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

    const mpPayment = await this.mercadoPago.getPayment(params.paymentId);

    if (mpPayment.status !== 'approved') {
      this.logger.log(`Pagamento MP ${params.paymentId} com status '${mpPayment.status}' — ignorado`);
      return { processed: false };
    }

    const reservaId = mpPayment.externalReference;
    if (!reservaId) {
      this.logger.error(`Pagamento MP ${params.paymentId} sem external_reference`);
      return { processed: false };
    }

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { reservaId },
      include: {
        reserva: {
          include: {
            hospede: { select: { id: true, nome: true, email: true } },
            estabelecimento: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!pagamento) {
      this.logger.warn(`Nenhum pagamento encontrado para reserva ${reservaId}`);
      return { processed: false };
    }

    if (pagamento.status === 'CONFIRMADO') {
      this.logger.log(`Pagamento ${pagamento.id} já confirmado — ignorado`);
      return { processed: false };
    }

    await this.prisma.$transaction([
      this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          status: 'CONFIRMADO',
          dadosPagamento: {
            ...((pagamento.dadosPagamento as Record<string, string>) ?? {}),
            mpStatus: mpPayment.status,
          },
        },
      }),
      this.prisma.reserva.update({
        where: { id: reservaId },
        data: { status: 'FINALIZADA' },
      }),
    ]);

    this.notifications.sendPaymentMercadoPagoConfirmed({
      email: pagamento.reserva.hospede.email,
      nome: pagamento.reserva.hospede.nome,
      codigoReserva: pagamento.reserva.codigoReserva,
      estabelecimento: pagamento.reserva.estabelecimento.nome,
      checkIn: pagamento.reserva.checkIn.toISOString().split('T')[0],
      checkOut: pagamento.reserva.checkOut.toISOString().split('T')[0],
    }).catch(() => {});

    return { processed: true };
  }

  async uploadComprovante(paymentId: string, buffer: Buffer, filename: string, mimetype: string) {
    const pagamentoExistente = await this.prisma.pagamento.findUnique({
      where: { id: paymentId },
      include: {
        reserva: {
          select: {
            estabelecimento: { select: { id: true, modoPagamento: true } },
          },
        },
      },
    });

    if (pagamentoExistente?.reserva?.estabelecimento?.modoPagamento === 'MERCADO_PAGO') {
      throw new ForbiddenException(
        'Este estabelecimento não aceita comprovante manual. O pagamento é reconhecido automaticamente via Mercado Pago.',
      );
    }

    const result = await this.uploads.uploadFile(buffer, filename, mimetype, 'comprovantes');
    const pagamento = await this.prisma.pagamento.update({
      where: { id: paymentId },
      data: { comprovanteUrl: result.url, comprovanteS3Key: result.s3Key, status: 'CONFIRMADO' },
      include: {
        reserva: {
          include: {
            hospede: { select: { id: true, nome: true, email: true } },
            estabelecimento: { select: { id: true, nome: true } },
          },
        },
      },
    });

    this.notifications.sendPaymentUploaded({
      email: pagamento.reserva.hospede.email,
      nome: pagamento.reserva.hospede.nome,
      codigoReserva: pagamento.reserva.codigoReserva,
      estabelecimento: pagamento.reserva.estabelecimento.nome,
    }).catch(() => {});

    return pagamento;
  }

  async confirm(paymentId: string) {
    const pagamentoExistente = await this.prisma.pagamento.findUnique({
      where: { id: paymentId },
      include: {
        reserva: {
          select: {
            estabelecimento: { select: { modoPagamento: true } },
          },
        },
      },
    });

    if (pagamentoExistente?.reserva?.estabelecimento?.modoPagamento === 'MERCADO_PAGO') {
      throw new ForbiddenException(
        'Este estabelecimento utiliza pagamento automático via Mercado Pago.',
      );
    }

    const pagamento = await this.prisma.pagamento.findUnique({ where: { id: paymentId } });
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

    this.notifications.sendPaymentConfirmed({
      email: reserva.hospede.email,
      nome: reserva.hospede.nome,
      codigoReserva: reserva.codigoReserva,
      estabelecimento: reserva.estabelecimento.nome,
      checkIn: reserva.checkIn.toISOString().split('T')[0],
      checkOut: reserva.checkOut.toISOString().split('T')[0],
    }).catch(() => {});

    return updated;
  }

  async findByReservation(reservaId: string) {
    return this.prisma.pagamento.findUnique({
      where: { reservaId },
      include: {
        reserva: {
          include: {
            hospede: { select: { id: true, nome: true } },
            estabelecimento: { select: { id: true, nome: true, modoPagamento: true } },
          },
        },
      },
    });
  }

  async getMercadoPagoCheckout(reservaId: string) {
    const pagamento = await this.prisma.pagamento.findUnique({
      where: { reservaId },
      select: { codigoTransacao: true, metodo: true, status: true, dadosPagamento: true },
    });
    if (!pagamento?.dadosPagamento) {
      throw new NotFoundException(
        'Checkout não encontrado. Gere o pagamento primeiro.',
      );
    }
    return {
      paymentId: pagamento.codigoTransacao,
      metodo: pagamento.metodo,
      status: pagamento.status,
      checkout: pagamento.dadosPagamento as Record<string, string>,
    };
  }

  async generatePix(reservaId: string) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id: reservaId } });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');
    return {
      pixKey: 'hospedarn@hospedarn.com.br',
      pixType: 'EMAIL',
      valor: reserva.valorTotal,
      codigoReserva: reserva.codigoReserva,
      qrCode: 'data:image/png;base64,PLACEHOLDER_QR_CODE',
      pixCopyPaste: '0020126580014br.gov.bcb.pix0136hospedarn@hospedarn.com.br5204000053039865802BR5913HospedaRN6008Natal, RN62070503***6304',
    };
  }
}