import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRegraSecaoDto, CreateRegraTopicoDto, UpdateRegraSecaoDto, UpdateRegraTopicoDto } from './dto/regra.dto';

const DEFAULT_SECOES = [
  {
    nome: 'Horários',
    topicos: [
      { label: 'Check-in', valor: '' },
      { label: 'Check-out', valor: '' },
    ],
  },
  {
    nome: 'Políticas',
    topicos: [],
  },
];

@Injectable()
export class RegrasService {
  constructor(private prisma: PrismaService) {}

  async findByEstablishment(estabelecimentoId: string) {
    let secoes = await this.prisma.regraSecao.findMany({
      where: { estabelecimentoId },
      include: { topicos: { orderBy: { ordem: 'asc' } } },
      orderBy: { ordem: 'asc' },
    });

    if (secoes.length === 0) {
      secoes = await this.seedDefaults(estabelecimentoId);
    }

    return secoes;
  }

  private async seedDefaults(estabelecimentoId: string) {
    const created: any[] = [];
    for (let i = 0; i < DEFAULT_SECOES.length; i++) {
      const secao = await this.prisma.regraSecao.create({
        data: {
          nome: DEFAULT_SECOES[i].nome,
          estabelecimentoId,
          ordem: i,
          topicos: {
            create: DEFAULT_SECOES[i].topicos.map((t, j) => ({
              label: t.label,
              valor: t.valor,
              ordem: j,
            })),
          },
        },
        include: { topicos: { orderBy: { ordem: 'asc' } } },
      });
      created.push(secao);
    }
    return created;
  }

  async createSecao(estabelecimentoId: string, dto: CreateRegraSecaoDto) {
    const count = await this.prisma.regraSecao.count({ where: { estabelecimentoId } });
    return this.prisma.regraSecao.create({
      data: {
        nome: dto.nome,
        estabelecimentoId,
        ordem: count,
        topicos: dto.topicos?.length
          ? { create: dto.topicos.map((t, i) => ({ label: t.label, valor: t.valor, ordem: i })) }
          : undefined,
      },
      include: { topicos: { orderBy: { ordem: 'asc' } } },
    });
  }

  async updateSecao(id: string, dto: UpdateRegraSecaoDto) {
    await this.findOneSecao(id);
    return this.prisma.regraSecao.update({
      where: { id },
      data: dto,
      include: { topicos: { orderBy: { ordem: 'asc' } } },
    });
  }

  async deleteSecao(id: string) {
    await this.findOneSecao(id);
    await this.prisma.regraSecao.delete({ where: { id } });
    return { message: 'Seção removida com sucesso' };
  }

  async createTopico(secaoId: string, dto: CreateRegraTopicoDto) {
    const count = await this.prisma.regraTopico.count({ where: { secaoId } });
    return this.prisma.regraTopico.create({
      data: { secaoId, label: dto.label, valor: dto.valor, ordem: count },
    });
  }

  async updateTopico(id: string, dto: UpdateRegraTopicoDto) {
    await this.findOneTopico(id);
    return this.prisma.regraTopico.update({ where: { id }, data: dto });
  }

  async deleteTopico(id: string) {
    await this.findOneTopico(id);
    await this.prisma.regraTopico.delete({ where: { id } });
    return { message: 'Tópico removido com sucesso' };
  }

  private async findOneSecao(id: string) {
    const secao = await this.prisma.regraSecao.findUnique({ where: { id } });
    if (!secao) throw new NotFoundException('Seção não encontrada');
    return secao;
  }

  private async findOneTopico(id: string) {
    const topico = await this.prisma.regraTopico.findUnique({ where: { id } });
    if (!topico) throw new NotFoundException('Tópico não encontrado');
    return topico;
  }
}
