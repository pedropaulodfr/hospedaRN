import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePaymentDto } from './dto/pagamento.dto';
import { UploadsService } from '../uploads/uploads.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreatePaymentDto) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id: dto.reservaId } });
    if (!reserva) throw new NotFoundException('Reserva nao encontrada');
    const existing = await this.prisma.pagamento.findUnique({ where: { reservaId: dto.reservaId } });
    if (existing) throw new BadRequestException('Pagamento ja existe para esta reserva');
    return this.prisma.pagamento.create({
      data: { reservaId: dto.reservaId, metodo: dto.metodo, valor: reserva.valorTotal, codigoTransacao: dto.codigoTransacao },
      include: { reserva: true },
    });
  }

  async uploadComprovante(paymentId: string, buffer: Buffer, filename: string, mimetype: string) {
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
    const pagamento = await this.prisma.pagamento.findUnique({ where: { id: paymentId } });
    if (!pagamento) throw new NotFoundException('Pagamento nao encontrado');

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
      include: { reserva: { include: { hospede: { select: { id: true, nome: true } } } } },
    });
  }

  async generatePix(reservaId: string) {
    const reserva = await this.prisma.reserva.findUnique({ where: { id: reservaId } });
    if (!reserva) throw new NotFoundException('Reserva nao encontrada');
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
