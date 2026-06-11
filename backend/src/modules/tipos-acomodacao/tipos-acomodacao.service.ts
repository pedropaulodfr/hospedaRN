import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTipoAcomodacaoDto } from './dto/tipo-acomodacao.dto';
@Injectable()
export class TiposAcomodacaoService {
  constructor(private prisma: PrismaService) {}
  async create(dto: CreateTipoAcomodacaoDto) { return this.prisma.tipoAcomodacao.create({ data: dto }); }
  async findAll() { return this.prisma.tipoAcomodacao.findMany({ orderBy: { nome: 'asc' } }); }
  async findOne(id: string) {
    const at = await this.prisma.tipoAcomodacao.findUnique({ where: { id } });
    if (!at) throw new NotFoundException('Tipo nao encontrado');
    return at;
  }
  async update(id: string, dto: Partial<CreateTipoAcomodacaoDto>) {
    await this.findOne(id);
    return this.prisma.tipoAcomodacao.update({ where: { id }, data: dto });
  }
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.tipoAcomodacao.delete({ where: { id } });
    return { message: 'Tipo removido' };
  }
}
