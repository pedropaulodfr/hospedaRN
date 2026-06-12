import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoomDto, UpdateRoomDto, CreateRoomPriceDto, CreateDateBlockDto } from './dto/quarto.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoomDto, userId: string, userRole: string) {
    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id: dto.estabelecimentoId },
    });

    if (!estabelecimento) throw new NotFoundException('Estabelecimento não encontrado');
    if (estabelecimento.proprietarioId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Sem permissão para adicionar quartos neste estabelecimento');
    }

    return this.prisma.quarto.create({
      data: dto,
      include: { tipoAcomodacao: true },
    });
  }

  async findByEstablishment(estabelecimentoId: string) {
    return this.prisma.quarto.findMany({
      where: { estabelecimentoId, ativo: true },
      include: {
        tipoAcomodacao: true,
        precos: { include: { temporada: true } },
        _count: { select: { reservas: true } },
      },
    });
  }

  async findOne(id: string) {
    const quarto = await this.prisma.quarto.findUnique({
      where: { id },
      include: {
        tipoAcomodacao: true,
        estabelecimento: { select: { id: true, nome: true, proprietarioId: true } },
        precos: { include: { temporada: true } },
        bloqueiosData: { where: { data: { gte: new Date() } }, orderBy: { data: 'asc' } },
      },
    });
    if (!quarto) throw new NotFoundException('Quarto não encontrado');
    return quarto;
  }

  async update(id: string, dto: UpdateRoomDto, userId: string, userRole: string) {
    const quarto = await this.findOne(id);
    if (quarto.estabelecimento.proprietarioId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Sem permissão para editar este quarto');
    }
    return this.prisma.quarto.update({ where: { id }, data: dto, include: { tipoAcomodacao: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.quarto.delete({ where: { id } });
    return { message: 'Quarto removido com sucesso' };
  }

  async setPrice(quartoId: string, dto: CreateRoomPriceDto) {
    return this.prisma.precoQuarto.upsert({
      where: { quartoId_temporadaId: { quartoId, temporadaId: dto.temporadaId } },
      update: { valor: dto.valor },
      create: { quartoId, temporadaId: dto.temporadaId, valor: dto.valor },
      include: { temporada: true },
    });
  }

  async checkAvailability(quartoId: string, checkIn: Date, checkOut: Date) {
    const reservas = await this.prisma.reserva.findMany({
      where: {
        quartoId,
        status: { in: ['SOLICITADA', 'CONFIRMADA', 'AGUARDANDO_PAGAMENTO'] },
        OR: [
          { checkIn: { lte: checkOut }, checkOut: { gte: checkIn } },
        ],
      },
    });

    const bloqueiosData = await this.prisma.bloqueioData.findMany({
      where: {
        quartoId,
        data: { gte: checkIn, lte: checkOut },
      },
    });

    return {
      disponivel: reservas.length === 0 && bloqueiosData.length === 0,
      reservasConflitantes: reservas.length,
      datasBlockadas: bloqueiosData.length,
    };
  }

  async blockDate(quartoId: string, dto: CreateDateBlockDto) {
    await this.findOne(quartoId);
    return this.prisma.bloqueioData.upsert({
      where: { quartoId_data: { quartoId, data: dto.data } },
      update: { motivo: dto.motivo },
      create: { quartoId, data: dto.data, motivo: dto.motivo },
    });
  }

  async unblockDate(quartoId: string, date: string) {
    await this.prisma.bloqueioData.deleteMany({
      where: { quartoId, data: new Date(date) },
    });
    return { message: 'Data desbloqueada com sucesso' };
  }

  async calculatePrice(quartoId: string, checkIn: Date, checkOut: Date): Promise<number> {
    const quarto = await this.findOne(quartoId);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const temporada = await this.prisma.temporada.findFirst({
      where: {
        dataInicio: { lte: checkIn },
        dataFim: { gte: checkIn },
      },
    });

    let pricePerNight = Number(quarto.precoBase);

    if (temporada) {
      const seasonPrice = await this.prisma.precoQuarto.findUnique({
        where: { quartoId_temporadaId: { quartoId, temporadaId: temporada.id } },
      });
      if (seasonPrice) {
        pricePerNight = Number(seasonPrice.valor);
      } else {
        pricePerNight = pricePerNight * (1 + Number(temporada.percentualAjuste) / 100);
      }
    }

    return pricePerNight * nights;
  }

  async findSeasons() {
    return this.prisma.temporada.findMany({
      orderBy: { dataInicio: 'asc' },
    });
  }
}
