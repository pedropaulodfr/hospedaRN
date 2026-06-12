import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFotoDto } from './dto/create-foto.dto';
import { UpdateFotoDto } from './dto/update-foto.dto';

@Injectable()
export class FotosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFotoDto) {
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

    const ownerId = dto.estabelecimentoId || dto.quartoId;
    if (!ownerId) throw new NotFoundException('Informe estabelecimentoId ou quartoId');

    if (dto.isCapa) {
      await this.prisma.foto.updateMany({
        where: {
          OR: [
            { estabelecimentoId: dto.estabelecimentoId },
            { quartoId: dto.quartoId },
          ].filter(Boolean) as any,
          isCapa: true,
        },
        data: { isCapa: false },
      });
    }

    return this.prisma.foto.create({
      data: {
        url: dto.url,
        s3Key: dto.s3Key,
        estabelecimentoId: dto.estabelecimentoId ?? null,
        quartoId: dto.quartoId ?? null,
        isCapa: dto.isCapa ?? false,
        ordem: dto.ordem ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateFotoDto) {
    const foto = await this.prisma.foto.findUnique({ where: { id } });
    if (!foto) throw new NotFoundException('Foto nao encontrada');

    if (dto.isCapa) {
      await this.prisma.foto.updateMany({
        where: { estabelecimentoId: foto.estabelecimentoId, isCapa: true, id: { not: id } },
        data: { isCapa: false },
      });
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
}
