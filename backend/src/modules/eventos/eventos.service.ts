import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto } from './dto/evento.dto';

/** Include padrão de Evento: cidades e fotos (galeria + capa), sempre em ordem de exibição. */
const EVENTO_INCLUDE = {
  eventosCidades: { include: { cidade: true } },
  // A lista de eventos é pública: expõe só o necessário para renderizar a mídia,
  // sem `s3Key` (mesmo critério do include de fotos em estabelecimentos).
  fotos: {
    select: { id: true, url: true, isCapa: true, ordem: true },
    orderBy: { ordem: 'asc' },
  },
} satisfies Prisma.EventoInclude;

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
      include: EVENTO_INCLUDE,
    });
  }

  async findAll(upcoming = false) {
    const where: any = { ativo: true };
    if (upcoming) where.dataFim = { gte: new Date() };
    return this.prisma.evento.findMany({
      where,
      include: EVENTO_INCLUDE,
      orderBy: { dataInicio: 'asc' },
    });
  }

  async findByCity(cidadeId: string) {
    return this.prisma.evento.findMany({
      where: { ativo: true, eventosCidades: { some: { cidadeId } }, dataFim: { gte: new Date() } },
      include: EVENTO_INCLUDE,
      orderBy: { dataInicio: 'asc' },
    });
  }

  async findOne(id: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      include: EVENTO_INCLUDE,
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
      include: EVENTO_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.evento.delete({ where: { id } });
    return { message: 'Evento removido com sucesso' };
  }
}
