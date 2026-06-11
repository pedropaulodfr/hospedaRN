import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}
  async toggle(userId: string, estabelecimentoId: string) {
    const existing = await this.prisma.favorito.findUnique({ where: { usuarioId_estabelecimentoId: { usuarioId: userId, estabelecimentoId } } });
    if (existing) {
      await this.prisma.favorito.delete({ where: { usuarioId_estabelecimentoId: { usuarioId: userId, estabelecimentoId } } });
      return { favorited: false };
    }
    await this.prisma.favorito.create({ data: { usuarioId: userId, estabelecimentoId } });
    return { favorited: true };
  }
  async findByUser(userId: string) {
    return this.prisma.favorito.findMany({
      where: { usuarioId: userId },
      include: { estabelecimento: { include: { cidade: true } } },
      orderBy: { criadoEm: 'desc' },
    });
  }
}
