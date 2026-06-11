import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/comodidade.dto';
@Injectable()
export class AmenitiesService {
  constructor(private prisma: PrismaService) {}
  async create(dto: CreateAmenityDto) {
    try { return await this.prisma.comodidade.create({ data: dto }); } catch { throw new ConflictException('Comodidade ja existe'); }
  }
  async findAll() { return this.prisma.comodidade.findMany({ orderBy: { nome: 'asc' } }); }
  async findOne(id: string) {
    const a = await this.prisma.comodidade.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Comodidade nao encontrada');
    return a;
  }
  async update(id: string, dto: UpdateAmenityDto) { await this.findOne(id); return this.prisma.comodidade.update({ where: { id }, data: dto }); }
  async remove(id: string) { await this.findOne(id); await this.prisma.comodidade.delete({ where: { id } }); return { message: 'Removida' }; }
}
