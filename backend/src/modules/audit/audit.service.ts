import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    usuarioId?: string;
    acao: string;
    entidade: string;
    entidadeId?: string;
    dadosAnteriores?: any;
    dadosNovos?: any;
    enderecoIp?: string;
    agenteUsuario?: string;
  }) {
    return this.prisma.logAuditoria.create({ data });
  }

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.logAuditoria.findMany({
        skip, take: limit,
        include: { usuario: { select: { id: true, nome: true, email: true } } },
        orderBy: { criadoEm: 'desc' },
      }),
      this.prisma.logAuditoria.count(),
    ]);
    return { data, total, page, limit };
  }
}
