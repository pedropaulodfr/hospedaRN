import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateEstablishmentDto,
  UpdateEstablishmentDto,
  BuscaEstabelecimentosDto,
} from './dto/estabelecimento.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

const ESTABLISHMENT_SELECT = {
  id: true,
  nome: true,
  descricao: true,
  contato: true,
  emailContato: true,
  website: true,
  endereco: true,
  cep: true,
  latitude: true,
  longitude: true,
  ativo: true,
  notaMedia: true,
  totalAvaliacoes: true,
  fotoPerfil: true,
  criadoEm: true,
  cidade: { select: { id: true, nome: true, estado: true } },
  proprietario: { select: { id: true, nome: true, email: true } },
  comodidades: { include: { comodidade: true } },
  fotos: { select: { id: true, url: true, isCapa: true, ordem: true } },
  quartos: {
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      precoBase: true,
      capacidade: true,
      tipoAcomodacao: { select: { id: true, nome: true } },
    },
  },
  _count: { select: { quartos: true, reservas: true } },
};

@Injectable()
export class EstablishmentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateEstablishmentDto) {
    if (!dto.emailContato) {
      throw new BadRequestException('O e-mail de contato é obrigatório para cadastrar o estabelecimento');
    }

    const { amenityIds, ...data } = dto;

    // 1. Procurar ou criar proprietário
    let proprietario = await this.prisma.usuario.findUnique({
      where: { email: dto.emailContato },
    });

    if (!proprietario) {
      const tempPassword = Math.random().toString(36).substring(2, 10) + 'A1!';
      const senhaHash = await bcrypt.hash(tempPassword, 12);
      const resetToken = randomUUID();
      const expires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas

      proprietario = await this.prisma.usuario.create({
        data: {
          nome: dto.nome,
          email: dto.emailContato,
          telefone: dto.contato,
          senhaHash,
          perfil: 'ESTABELECIMENTO',
          ativo: true,
          tokenRecuperacaoSenha: resetToken,
          expiracaoRecuperacaoSenha: expires,
        },
      });

      // 2. Disparar e-mail de ativação/recuperação
      try {
        const resetUrl = `http://localhost:5173/redefinir-senha?token=${resetToken}`;
        await this.notificationsService.sendForgotPassword({
          email: proprietario.email,
          nome: proprietario.nome,
          token: resetToken,
          resetUrl,
        });
      } catch (err) {
        console.error('Falha ao enfileirar e-mail de redefinição de senha (Redis/BullMQ inativo):', err);
      }
    }

    const estabelecimento = await this.prisma.estabelecimento.create({
      data: {
        ...data,
        proprietarioId: proprietario.id,
        comodidades: amenityIds
          ? {
              create: amenityIds.map((comodidadeId) => ({ comodidadeId })),
            }
          : undefined,
      },
      select: ESTABLISHMENT_SELECT,
    });

    if (dto.latitude && dto.longitude) {
      await this.updateLocation(estabelecimento.id, dto.latitude, dto.longitude);
    }

    return estabelecimento;
  }

  async findAll(dto: BuscaEstabelecimentosDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 12;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (dto.adminView) {
      if (dto.ativo !== undefined) where.ativo = dto.ativo;
    } else {
      where.ativo = dto.ativo !== undefined ? dto.ativo : true;
    }
    if (dto.cidadeId) where.cidadeId = dto.cidadeId;

    if (dto.search) {
      where.OR = [
        { nome: { contains: dto.search, mode: 'insensitive' } },
        { descricao: { contains: dto.search, mode: 'insensitive' } },
        { cidade: { nome: { contains: dto.search, mode: 'insensitive' } } },
      ];
    }

    if (dto.minRating !== undefined) {
      where.notaMedia = { gte: dto.minRating };
    }

    // Filtros de quarto (preço base e tipo de acomodação)
    const roomConditions: any = { ativo: true };
    if (dto.minPrice !== undefined) {
      roomConditions.precoBase = { ...roomConditions.precoBase, gte: dto.minPrice };
    }
    if (dto.maxPrice !== undefined) {
      roomConditions.precoBase = { ...roomConditions.precoBase, lte: dto.maxPrice };
    }
    if (dto.accommodationTypeIds) {
      const typeIds = dto.accommodationTypeIds.split(',').filter(Boolean);
      if (typeIds.length > 0) {
        roomConditions.tipoAcomodacaoId = { in: typeIds };
      }
    }

    if (Object.keys(roomConditions).length > 1) { // Tem filtros além de 'ativo: true'
      where.quartos = {
        some: roomConditions,
      };
    }

    // Filtro de comodidades (deve conter TODAS as selecionadas)
    if (dto.amenityIds) {
      const amenityIds = dto.amenityIds.split(',').filter(Boolean);
      if (amenityIds.length > 0) {
        where.AND = amenityIds.map((amenityId) => ({
          comodidades: {
            some: {
              comodidadeId: amenityId,
            },
          },
        }));
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.estabelecimento.findMany({
        where,
        skip,
        take: limit,
        select: ESTABLISHMENT_SELECT,
        orderBy: { notaMedia: 'desc' },
      }),
      this.prisma.estabelecimento.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findNearby(lat: number, lng: number, radiusKm = 50) {
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT e.id, e.nome, e.descricao, e.latitude, e.longitude, e.nota_media,
             e.total_avaliacoes, e.imagem_capa,
             ST_Distance(e.localizacao::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distancia_km
      FROM "Estabelecimento" e
      WHERE e.ativo = true AND e.localizacao IS NOT NULL
        AND ST_DWithin(e.localizacao::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
      ORDER BY distancia_km ASC
      LIMIT 20
    `, lng, lat, radiusKm);
  }

  async findOne(id: string) {
    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id },
      include: {
        cidade: true,
        proprietario: { select: { id: true, nome: true, email: true, telefone: true } },
        comodidades: { include: { comodidade: true } },
        quartos: {
          where: { ativo: true },
          include: { tipoAcomodacao: true, precos: { include: { temporada: true } } },
        },
        _count: { select: { reservas: { where: { status: 'FINALIZADA' } } } },
      },
    });

    if (!estabelecimento) throw new NotFoundException('Estabelecimento não encontrado');
    return estabelecimento;
  }

  async findByOwner(proprietarioId: string) {
    return this.prisma.estabelecimento.findMany({
      where: { proprietarioId },
      select: ESTABLISHMENT_SELECT,
      orderBy: { criadoEm: 'desc' },
    });
  }

  async update(id: string, dto: UpdateEstablishmentDto, userId: string, userRole: string) {
    const estabelecimento = await this.findOne(id);

    if (estabelecimento.proprietario.id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Sem permissão para editar este estabelecimento');
    }

    const { amenityIds, ...data } = dto;

    const updated = await this.prisma.estabelecimento.update({
      where: { id },
      data: {
        ...data,
        comodidades: amenityIds
          ? {
              deleteMany: {},
              create: amenityIds.map((comodidadeId) => ({ comodidadeId })),
            }
          : undefined,
      },
      select: ESTABLISHMENT_SELECT,
    });

    if (dto.latitude && dto.longitude) {
      await this.updateLocation(id, dto.latitude, dto.longitude);
    }

    return updated;
  }


  async toggleActive(id: string) {
    const estabelecimento = await this.findOne(id);
    return this.prisma.estabelecimento.update({
      where: { id },
      data: { ativo: !estabelecimento.ativo },
      select: ESTABLISHMENT_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.estabelecimento.delete({ where: { id } });
    return { message: 'Estabelecimento removido com sucesso' };
  }

  private async updateLocation(id: string, lat: number, lng: number) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "Estabelecimento" SET localizacao = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3::uuid`,
      lng, lat, id,
    );
  }
}
