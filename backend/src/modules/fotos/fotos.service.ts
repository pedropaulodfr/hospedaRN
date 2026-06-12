import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFotoDto } from './dto/create-foto.dto';
import { UpdateFotoDto } from './dto/update-foto.dto';

@Injectable()
export class FotosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFotoDto) {
    await this.prisma.estabelecimento.findUniqueOrThrow({ where: { id: dto.estabelecimentoId } }).catch(() => {
      throw new NotFoundException('Estabelecimento nao encontrado');
    });

    if (dto.isCapa) {
      await this.prisma.foto.updateMany({
        where: { entidade: 'estabelecimento', entidadeId: dto.estabelecimentoId, isCapa: true },
        data: { isCapa: false },
      });
    }

    return this.prisma.foto.create({
      data: {
        url: dto.url,
        s3Key: dto.s3Key,
        entidade: 'estabelecimento',
        entidadeId: dto.estabelecimentoId,
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
        where: { entidade: 'estabelecimento', entidadeId: foto.entidadeId, isCapa: true, id: { not: id } },
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
      where: { entidade: 'estabelecimento', entidadeId: estabelecimentoId },
      orderBy: { ordem: 'asc' },
    });
  }
}
