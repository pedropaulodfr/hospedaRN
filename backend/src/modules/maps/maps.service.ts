import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MapsService {
  constructor(private prisma: PrismaService) {}

  async getNearbyEstablishments(lat: number, lng: number, radiusKm = 50) {
    return this.prisma.$queryRaw<any[]>`
      SELECT e.id, e.nome, e.latitude, e.longitude, e.nota_media, e.total_avaliacoes,
             c.nome as cidade,
             ST_Distance(e.localizacao::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 AS distancia_km
      FROM "Estabelecimento" e
      JOIN "Cidade" c ON c.id = e.city_id
      WHERE e.ativo = true AND e.localizacao IS NOT NULL
        AND ST_DWithin(e.localizacao::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusKm} * 1000)
      ORDER BY distancia_km ASC
      LIMIT 50
    `;
  }

  async getCitiesMap() {
    return this.prisma.cidade.findMany({
      where: { ativo: true },
      select: {
        id: true, nome: true, estado: true, latitude: true, longitude: true,
        _count: { select: { estabelecimentos: { where: { ativo: true } } } },
      },
    });
  }

  async calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const result = await this.prisma.$queryRaw<{ distancia_km: number }[]>`
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint(${lng1}, ${lat1}), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${lng2}, ${lat2}), 4326)::geography
      ) / 1000 AS distancia_km
    `;
    return { distanciaKm: Number(result[0]?.distancia_km) };
  }
}
