import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateReservationDto, CancelReservationDto } from './dto/reserva.dto';
import { RoomsService } from '../quartos/quartos.service';
import { NotificationsService } from '../notifications/notifications.service';

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
      modoPagamento: true,
      proprietario: { select: { id: true, nome: true, email: true } },
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
    private notifications: NotificationsService,
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

    // Snapshot do modo de pagamento: se o estabelecimento trocar a configuração
    // depois, esta reserva continua no modo em que foi criada.
    const estabelecimentoModo = await this.prisma.estabelecimento.findUnique({
      where: { id: dto.estabelecimentoId },
      select: { modoPagamento: true },
    });

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
        modoPagamento: estabelecimentoModo?.modoPagamento ?? 'PADRAO',
        observacoes: dto.observacoes,
        status: 'SOLICITADA',
      },
      include: RESERVATION_INCLUDE,
    });

    this.notifications.sendReservationCreated({
      email: reserva.hospede.email,
      nome: reserva.hospede.nome,
      codigoReserva: reserva.codigoReserva,
      estabelecimento: reserva.estabelecimento.nome,
      checkIn: reserva.checkIn.toISOString().split('T')[0],
      checkOut: reserva.checkOut.toISOString().split('T')[0],
      valorTotal: Number(reserva.valorTotal),
    }).catch(() => {});

    const estabEmail = reserva.estabelecimento.emailContato || reserva.estabelecimento.proprietario.email;
    if (estabEmail) {
      this.notifications.sendReservationPendingForEstablishment({
        email: estabEmail,
        estabelecimento: reserva.estabelecimento.nome,
        hospedeNome: reserva.hospede.nome,
        codigoReserva: reserva.codigoReserva,
        checkIn: reserva.checkIn.toISOString().split('T')[0],
        checkOut: reserva.checkOut.toISOString().split('T')[0],
        quarto: reserva.quarto.nome,
        adultos: reserva.adultos,
        criancas: reserva.criancas,
        valorTotal: Number(reserva.valorTotal),
      }).catch(() => {});
    }

    return reserva;
  }

  async findAll(filters: {
    hospedeId?: string;
    estabelecimentoId?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
    campoData?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.hospedeId) where.hospedeId = filters.hospedeId;
    if (filters.estabelecimentoId) where.estabelecimentoId = filters.estabelecimentoId;
    if (filters.status) where.status = filters.status;

    // Intervalo de datas (opcional). `estadia` = reservas que se sobrepõem ao
    // intervalo informado (inclui quem já estava hospedado no início da janela);
    // `solicitacao` = data em que a reserva foi criada. Fuso: America/Fortaleza.
    const filtroData = this.buildDateFilter(filters);
    if (filtroData) Object.assign(where, filtroData);

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

  /**
   * Monta o fragmento de `where` para o intervalo de datas.
   * Datas inválidas são ignoradas (não derrubam a listagem).
   *
   * - `estadia` (padrão): sobreposição com o intervalo — `checkIn <= fim` e
   *   `checkOut >= início`. Assim uma reserva de 20/11 a 25/11 aparece ao filtrar
   *   22/11–23/11, como se espera de "período da estadia".
   * - `solicitacao`: `criadoEm` dentro do intervalo (timestamptz, UTC-3).
   */
  private buildDateFilter(filters: {
    dataInicio?: string;
    dataFim?: string;
    campoData?: string;
  }): Record<string, any> | null {
    const valido = (valor?: string) => Boolean(valor && /^\d{4}-\d{2}-\d{2}$/.test(valor));

    const temInicio = valido(filters.dataInicio);
    const temFim = valido(filters.dataFim);
    if (!temInicio && !temFim) return null;

    if (filters.campoData === 'solicitacao') {
      const range: { gte?: Date; lte?: Date } = {};
      if (temInicio) range.gte = new Date(`${filters.dataInicio}T00:00:00-03:00`);
      if (temFim) range.lte = new Date(`${filters.dataFim}T23:59:59.999-03:00`);
      return { criadoEm: range };
    }

    // checkIn/checkOut são `@db.Date`: compara em UTC (meia-noite).
    const where: Record<string, any> = {};
    if (temFim) where.checkIn = { lte: new Date(`${filters.dataFim}T00:00:00.000Z`) };
    if (temInicio) where.checkOut = { gte: new Date(`${filters.dataInicio}T00:00:00.000Z`) };
    return where;
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

    const updatedReserva = await this.prisma.reserva.update({
      where: { id },
      data: { status: 'CONFIRMADA' },
      include: RESERVATION_INCLUDE,
    });

    this.notifications.sendReservationConfirmed({
      email: updatedReserva.hospede.email,
      nome: updatedReserva.hospede.nome,
      codigoReserva: updatedReserva.codigoReserva,
      estabelecimento: updatedReserva.estabelecimento.nome,
      checkIn: updatedReserva.checkIn.toISOString().split('T')[0],
      checkOut: updatedReserva.checkOut.toISOString().split('T')[0],
      valorTotal: Number(updatedReserva.valorTotal),
      pixKey: 'hospedarn@hospedarn.com.br',
      pixType: 'E-mail',
      pagamentoAutomatico:
        (updatedReserva.modoPagamento ??
          updatedReserva.estabelecimento.modoPagamento) === 'MERCADO_PAGO',
    }).catch(() => {});

    return updatedReserva;
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

    // Reserva com chegada já registrada não pode ser cancelada: evita deixar o
    // CheckIn "órfão" de uma reserva cancelada (inconsistência status × estadia).
    const checkinExistente = await this.prisma.checkIn.findUnique({
      where: { reservaId: id },
      select: { id: true },
    });
    if (checkinExistente) {
      throw new BadRequestException(
        'Reserva com check-in já realizado não pode ser cancelada',
      );
    }

    const cancelledReserva = await this.prisma.reserva.update({
      where: { id },
      data: { status: 'CANCELADA', cancelamentoMotivo: dto.motivo },
      include: RESERVATION_INCLUDE,
    });

    this.notifications.sendReservationCancelled({
      email: cancelledReserva.hospede.email,
      nome: cancelledReserva.hospede.nome,
      codigoReserva: cancelledReserva.codigoReserva,
      estabelecimento: cancelledReserva.estabelecimento.nome,
      motivo: cancelledReserva.cancelamentoMotivo || undefined,
    }).catch(() => {});

    return cancelledReserva;
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
