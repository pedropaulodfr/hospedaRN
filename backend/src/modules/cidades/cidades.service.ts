import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCityDto, UpdateCityDto } from './dto/cidade.dto';

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCityDto) {
    const cidade = await this.prisma.cidade.create({
      data: {
        nome: dto.nome,
        estado: dto.estado || 'RN',
        latitude: dto.latitude,
        longitude: dto.longitude,
        descricao: dto.descricao,
        fotoPerfil: dto.fotoPerfil,
      },
    });

    // Atualiza a geometria PostGIS
    await this.prisma.$executeRawUnsafe(
      `UPDATE "Cidade" SET localizacao = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3::uuid`,
      dto.longitude,
      dto.latitude,
      cidade.id,
    );

    return this.findOne(cidade.id);
  }

  async findAll(ativo?: boolean) {
    const where = ativo !== undefined ? { ativo } : {};
    return this.prisma.cidade.findMany({
      where,
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        estado: true,
        latitude: true,
        longitude: true,
        descricao: true,
        imagemUrl: true,
        fotoPerfil: true,
        ativo: true,
        _count: { select: { estabelecimentos: true } },
      },
    });
  }

  async findOne(id: string) {
    const cidade = await this.prisma.cidade.findUnique({
      where: { id },
      include: {
        _count: { select: { estabelecimentos: { where: { ativo: true } } } },
      },
    });
    if (!cidade) throw new NotFoundException('Cidade não encontrada');
    return cidade;
  }

  async update(id: string, dto: UpdateCityDto) {
    await this.findOne(id);

    const cidade = await this.prisma.cidade.update({
      where: { id },
      data: dto,
    });

    if (dto.latitude || dto.longitude) {
      const lat = dto.latitude ?? Number(cidade.latitude);
      const lng = dto.longitude ?? Number(cidade.longitude);
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Cidade" SET localizacao = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3::uuid`,
        lng, lat, id,
      );
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.cidade.delete({ where: { id } });
    return { message: 'Cidade removida com sucesso' };
  }

  async findNearby(lat: number, lng: number, radiusKm = 50) {
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, nome, estado, latitude, longitude, descricao, imagem_url,
             ST_Distance(localizacao::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distancia_km
      FROM "Cidade"
      WHERE ativo = true
        AND localizacao IS NOT NULL
        AND ST_DWithin(localizacao::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
      ORDER BY distancia_km ASC
    `, lng, lat, radiusKm);
  }
}
