import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async globalDashboard() {
    const [totalUsers, totalEstablishments, totalReservations, totalRevenue] = await Promise.all([
      this.prisma.usuario.count(),
      this.prisma.estabelecimento.count({ where: { ativo: true } }),
      this.prisma.reserva.count(),
      this.prisma.reserva.aggregate({
        where: { status: { in: ['CONFIRMADA', 'FINALIZADA'] } },
        _sum: { valorTotal: true },
      }),
    ]);

    return {
      totalUsers,
      totalEstablishments,
      totalReservations,
      totalRevenue: totalRevenue._sum.valorTotal || 0,
    };
  }

  async reservationsByCity() {
    return this.prisma.$queryRaw<any[]>`
      SELECT c.nome as cidade, COUNT(r.id) as total_reservas, SUM(r.valor_total) as receita
      FROM "Reserva" r
      JOIN "Estabelecimento" e ON e.id = r.estabelecimento_id
      JOIN "Cidade" c ON c.id = e.cidade_id
      GROUP BY c.id, c.nome
      ORDER BY total_reservas DESC
    `;
  }

  async reservationsByEstablishment(estabelecimentoId?: string) {
    const where: any = {};
    if (estabelecimentoId) where.estabelecimentoId = estabelecimentoId;

    return this.prisma.reserva.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { valorTotal: true },
    });
  }

  async occupancyReport(estabelecimentoId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const reservas = await this.prisma.reserva.findMany({
      where: {
        estabelecimentoId,
        status: { in: ['CONFIRMADA', 'FINALIZADA'] },
        checkIn: { gte: startDate, lte: endDate },
      },
      include: { quarto: true },
    });

    const totalDays = endDate.getDate();
    const quartos = await this.prisma.quarto.count({ where: { estabelecimentoId, ativo: true } });
    const occupiedDays = reservas.reduce((acc, r) => {
      const nights = Math.ceil((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / (1000 * 60 * 60 * 24));
      return acc + nights;
    }, 0);

    return {
      mes: month, ano: year,
      totalQuartos: quartos,
      totalDias: totalDays,
      diasOcupados: occupiedDays,
      taxaOcupacao: quartos > 0 ? ((occupiedDays / (quartos * totalDays)) * 100).toFixed(2) + '%' : '0%',
      reservasConfirmadas: reservas.filter(r => r.status === 'CONFIRMADA').length,
      reservasFinalizadas: reservas.filter(r => r.status === 'FINALIZADA').length,
      faturamentoEstimado: reservas.reduce((acc, r) => acc + Number(r.valorTotal), 0),
    };
  }

  async upcomingEvents() {
    return this.prisma.evento.findMany({
      where: { ativo: true, dataInicio: { gte: new Date() } },
      include: { eventosCidades: { include: { cidade: true } } },
      orderBy: { dataInicio: 'asc' },
      take: 10,
    });
  }

  async cancellationReport() {
    return this.prisma.$queryRaw<any[]>`
      SELECT DATE_TRUNC('month', r.atualizado_em) as mes,
             COUNT(r.id) as cancelamentos,
             SUM(r.valor_total) as valor_perdido
      FROM "Reserva" r
      WHERE r.status = 'CANCELADA'
      GROUP BY DATE_TRUNC('month', r.atualizado_em)
      ORDER BY mes DESC
      LIMIT 12
    `;
  }
}
