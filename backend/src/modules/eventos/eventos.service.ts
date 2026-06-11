import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto } from './dto/evento.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEventDto) {
    const { cityIds, ...data } = dto;
    return this.prisma.evento.create({
      data: {
        ...data,
        eventosCidades: cityIds ? { create: cityIds.map(cidadeId => ({ cidadeId })) } : undefined,
      },
      include: { eventosCidades: { include: { cidade: true } } },
    });
  }

  async findAll(upcoming = false) {
    const where: any = { ativo: true };
    if (upcoming) where.dataFim = { gte: new Date() };
    return this.prisma.evento.findMany({
      where,
      include: { eventosCidades: { include: { cidade: true } } },
      orderBy: { dataInicio: 'asc' },
    });
  }

  async findByCity(cidadeId: string) {
    return this.prisma.evento.findMany({
      where: { ativo: true, eventosCidades: { some: { cidadeId } }, dataFim: { gte: new Date() } },
      include: { eventosCidades: { include: { cidade: true } } },
      orderBy: { dataInicio: 'asc' },
    });
  }

  async findOne(id: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      include: { eventosCidades: { include: { cidade: true } } },
    });
    if (!evento) throw new NotFoundException('Evento nao encontrado');
    return evento;
  }

  async update(id: string, dto: Partial<CreateEventDto>) {
    await this.findOne(id);
    const { cityIds, ...data } = dto;
    return this.prisma.evento.update({
      where: { id },
      data: {
        ...data,
        eventosCidades: cityIds ? { deleteMany: {}, create: cityIds.map(cidadeId => ({ cidadeId })) } : undefined,
      },
      include: { eventosCidades: { include: { cidade: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.evento.delete({ where: { id } });
    return { message: 'Evento removido com sucesso' };
  }
}
