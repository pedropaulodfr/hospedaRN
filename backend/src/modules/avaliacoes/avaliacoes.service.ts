import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateReviewDto } from './dto/avaliacao.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReviewDto, userId: string) {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id: dto.reservaId },
      include: { avaliacao: true },
    });
    if (!reserva) throw new NotFoundException('Reserva nao encontrada');
    if (reserva.hospedeId !== userId) throw new ForbiddenException('Sem permissao');
    if (reserva.status !== 'FINALIZADA') throw new BadRequestException('So e possivel avaliar reservas finalizadas');
    if (reserva.avaliacao) throw new BadRequestException('Esta reserva ja foi avaliada');
    
    const avaliacao = await this.prisma.avaliacao.create({
      data: { reservaId: dto.reservaId, nota: dto.nota, comentario: dto.comentario },
      include: { reserva: { include: { estabelecimento: true } } },
    });

    // Update estabelecimento rating
    const stats = await this.prisma.avaliacao.aggregate({
      where: { reserva: { estabelecimentoId: reserva.estabelecimentoId } },
      _avg: { nota: true }, _count: { nota: true },
    });
    await this.prisma.estabelecimento.update({
      where: { id: reserva.estabelecimentoId },
      data: { notaMedia: stats._avg.nota || 0, totalAvaliacoes: stats._count.nota },
    });

    return avaliacao;
  }

  async findByEstablishment(estabelecimentoId: string) {
    return this.prisma.avaliacao.findMany({
      where: { reserva: { estabelecimentoId } },
      include: { reserva: { include: { hospede: { select: { id: true, nome: true } } } } },
      orderBy: { criadoEm: 'desc' },
    });
  }
}
