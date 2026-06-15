import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTipoAcomodacaoDto } from './dto/tipo-acomodacao.dto';
@Injectable()
export class TiposAcomodacaoService {
  constructor(private prisma: PrismaService) {}
  async create(dto: CreateTipoAcomodacaoDto, userId: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    let estabelecimentoId = dto.estabelecimentoId;
    if (user.perfil === 'ESTABELECIMENTO') {
      const est = await this.prisma.estabelecimento.findFirst({
        where: { proprietarioId: userId },
        select: { id: true },
      });
      if (!est) throw new ForbiddenException('Estabelecimento não encontrado para este usuário');
      estabelecimentoId = est.id;
    }

    return this.prisma.tipoAcomodacao.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        estabelecimentoId,
      },
    });
  }
  async findAll() { return this.prisma.tipoAcomodacao.findMany({ orderBy: { nome: 'asc' } }); }
  async findByEstablishment(estabelecimentoId: string) {
    return this.prisma.tipoAcomodacao.findMany({
      where: {
        OR: [
          { estabelecimentoId: null },
          { estabelecimentoId },
        ],
      },
      orderBy: { nome: 'asc' },
    });
  }
  async findOne(id: string) {
    const at = await this.prisma.tipoAcomodacao.findUnique({ where: { id } });
    if (!at) throw new NotFoundException('Tipo nao encontrado');
    return at;
  }
  async update(id: string, dto: Partial<CreateTipoAcomodacaoDto>) {
    await this.findOne(id);
    return this.prisma.tipoAcomodacao.update({ where: { id }, data: dto });
  }
  async remove(id: string, userId?: string) {
    const tipo = await this.findOne(id);

    if (userId) {
      const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('Usuário não encontrado');

      if (user.perfil === 'ESTABELECIMENTO') {
        const est = await this.prisma.estabelecimento.findFirst({
          where: { proprietarioId: userId },
          select: { id: true },
        });
        if (!est || tipo.estabelecimentoId !== est.id) {
          throw new ForbiddenException('Sem permissão para excluir este tipo');
        }
      }
    }

    const quartosVinculados = await this.prisma.quarto.count({ where: { tipoAcomodacaoId: id } });
    await this.prisma.tipoAcomodacao.delete({ where: { id } });
    return {
      message: 'Tipo de acomodação removido com sucesso',
      quartosDesvinculados: quartosVinculados,
    };
  }
}
