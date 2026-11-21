import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFotoDto } from './dto/create-foto.dto';
import { UpdateFotoDto } from './dto/update-foto.dto';

@Injectable()
export class FotosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFotoDto) {
    const donos = [dto.estabelecimentoId, dto.quartoId, dto.eventoId].filter(Boolean);
    if (donos.length === 0) throw new NotFoundException('Informe estabelecimentoId, quartoId ou eventoId');
    if (donos.length > 1) {
      throw new BadRequestException('A foto deve pertencer a apenas um dono: estabelecimento, quarto ou evento');
    }

    if (dto.estabelecimentoId) {
      await this.prisma.estabelecimento.findUniqueOrThrow({ where: { id: dto.estabelecimentoId } }).catch(() => {
        throw new NotFoundException('Estabelecimento nao encontrado');
      });
    }
    if (dto.quartoId) {
      await this.prisma.quarto.findUniqueOrThrow({ where: { id: dto.quartoId } }).catch(() => {
        throw new NotFoundException('Quarto nao encontrado');
      });
    }
    if (dto.eventoId) {
      await this.prisma.evento.findUniqueOrThrow({ where: { id: dto.eventoId } }).catch(() => {
        throw new NotFoundException('Evento nao encontrado');
      });
    }

    if (dto.isCapa) {
      const escopo = this.escopoDono(dto);
      if (escopo.length) {
        await this.prisma.foto.updateMany({
          where: { OR: escopo, isCapa: true },
          data: { isCapa: false },
        });
      }
    }

    return this.prisma.foto.create({
      data: {
        url: dto.url,
        s3Key: dto.s3Key,
        estabelecimentoId: dto.estabelecimentoId ?? null,
        quartoId: dto.quartoId ?? null,
        eventoId: dto.eventoId ?? null,
        isCapa: dto.isCapa ?? false,
        ordem: dto.ordem ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateFotoDto) {
    const foto = await this.prisma.foto.findUnique({ where: { id } });
    if (!foto) throw new NotFoundException('Foto nao encontrada');

    if (dto.isCapa) {
      const escopo = this.escopoDono(foto);
      if (escopo.length) {
        await this.prisma.foto.updateMany({
          where: { OR: escopo, isCapa: true, id: { not: id } },
          data: { isCapa: false },
        });
      }
    }

    return this.prisma.foto.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const foto = await this.prisma.foto.findUnique({ where: { id } });
    if (!foto) throw new NotFoundException('Foto nao encontrada');
    return this.prisma.foto.delete({ where: { id } });
  }

  async findByEstablishment(estabelecimentoId: string) {
    return this.prisma.foto.findMany({
      where: { estabelecimentoId },
      orderBy: { ordem: 'asc' },
    });
  }

  async findByRoom(quartoId: string) {
    return this.prisma.foto.findMany({
      where: { quartoId },
      orderBy: { ordem: 'asc' },
    });
  }

  async findByEvent(eventoId: string) {
    return this.prisma.foto.findMany({
      where: { eventoId },
      orderBy: { ordem: 'asc' },
    });
  }

  /** Escopo do dono da foto (estabelecimento, quarto ou evento), ignorando ids ausentes/nulos. */
  private escopoDono(dono: {
    estabelecimentoId?: string | null;
    quartoId?: string | null;
    eventoId?: string | null;
  }) {
    const escopo: Array<{ estabelecimentoId: string } | { quartoId: string } | { eventoId: string }> = [];
    if (dono.estabelecimentoId) escopo.push({ estabelecimentoId: dono.estabelecimentoId });
    if (dono.quartoId) escopo.push({ quartoId: dono.quartoId });
    if (dono.eventoId) escopo.push({ eventoId: dono.eventoId });
    return escopo;
  }
}
