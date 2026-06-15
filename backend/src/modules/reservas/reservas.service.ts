import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateReservationDto, CancelReservationDto } from './dto/reserva.dto';
import { RoomsService } from '../quartos/quartos.service';

function generateBookingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'HRN';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const RESERVATION_INCLUDE = {
  hospede: { select: { id: true, nome: true, email: true, telefone: true } },
  estabelecimento: {
    select: {
      id: true,
      nome: true,
      contato: true,
      endereco: true,
      emailContato: true,
      website: true,
      cidade: { select: { id: true, nome: true, estado: true } },
      fotos: { select: { id: true, url: true, isCapa: true } },
    },
  },
  quarto: { select: { id: true, nome: true, capacidade: true, fotos: { select: { id: true, url: true, isCapa: true } } } },
  pagamento: true,
  avaliacao: true,
};

@Injectable()
export class ReservationsService {
  constructor(
    private prisma: PrismaService,
    private roomsService: RoomsService,
  ) {}

  async create(dto: CreateReservationDto, hospedeId: string) {
    const checkIn = new Date(dto.checkIn);
    const checkOut = new Date(dto.checkOut);

    if (checkIn >= checkOut) {
      throw new BadRequestException('Check-out deve ser posterior ao check-in');
    }

    const availability = await this.roomsService.checkAvailability(dto.quartoId, checkIn, checkOut);
    if (!availability.disponivel) {
      throw new BadRequestException('Quarto não disponível para o período selecionado');
    }

    const valorTotal = await this.roomsService.calculatePrice(dto.quartoId, checkIn, checkOut);

    const reserva = await this.prisma.reserva.create({
      data: {
        codigoReserva: generateBookingCode(),
        hospedeId,
        estabelecimentoId: dto.estabelecimentoId,
        quartoId: dto.quartoId,
        checkIn,
        checkOut,
        adultos: dto.adultos || 1,
        criancas: dto.criancas || 0,
        valorTotal,
        observacoes: dto.observacoes,
        status: 'SOLICITADA',
      },
      include: RESERVATION_INCLUDE,
    });

    return reserva;
  }

  async findAll(filters: { hospedeId?: string; estabelecimentoId?: string; status?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.hospedeId) where.hospedeId = filters.hospedeId;
    if (filters.estabelecimentoId) where.estabelecimentoId = filters.estabelecimentoId;
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.reserva.findMany({
        where, skip, take: limit,
        include: RESERVATION_INCLUDE,
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.reserva.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id },
      include: RESERVATION_INCLUDE,
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');
    return reserva;
  }

  async findByCode(code: string) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { codigoReserva: code },
      include: RESERVATION_INCLUDE,
    });
    if (!reserva) throw new NotFoundException('Reserva não encontrada');
    return reserva;
  }

  async confirm(id: string, userId: string, userRole: string) {
    const reserva = await this.findOne(id);
    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id: reserva.estabelecimentoId },
    });

    if (estabelecimento!.proprietarioId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Sem permissão para confirmar esta reserva');
    }

    if (reserva.status !== 'SOLICITADA') {
      throw new BadRequestException('Somente reservas com status SOLICITADA podem ser confirmadas');
    }

    return this.prisma.reserva.update({
      where: { id },
      data: { status: 'CONFIRMADA' },
      include: RESERVATION_INCLUDE,
    });
  }

  async cancel(id: string, dto: CancelReservationDto, userId: string, userRole: string) {
    const reserva = await this.findOne(id);

    const isHospede = reserva.hospedeId === userId;
    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id: reserva.estabelecimentoId },
    });
    const isOwner = estabelecimento!.proprietarioId === userId;

    if (!isHospede && !isOwner && userRole !== 'ADMIN') {
      throw new ForbiddenException('Sem permissão para cancelar esta reserva');
    }

    if (['FINALIZADA', 'CANCELADA'].includes(reserva.status)) {
      throw new BadRequestException('Esta reserva não pode ser cancelada');
    }

    return this.prisma.reserva.update({
      where: { id },
      data: { status: 'CANCELADA', cancelamentoMotivo: dto.motivo },
      include: RESERVATION_INCLUDE,
    });
  }

  async finalize(id: string) {
    const reserva = await this.findOne(id);
    if (reserva.status !== 'CONFIRMADA' && reserva.status !== 'AGUARDANDO_PAGAMENTO') {
      throw new BadRequestException('Somente reservas CONFIRMADAS ou em AGUARDANDO_PAGAMENTO podem ser finalizadas');
    }
    return this.prisma.reserva.update({
      where: { id },
      data: { status: 'FINALIZADA' },
      include: RESERVATION_INCLUDE,
    });
  }
}
