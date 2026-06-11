import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MapsService } from './maps.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Maps')
@Controller('maps')
export class MapsController {
  constructor(private readonly service: MapsService) {}

  @Public()
  @Get('estabelecimentos/nearby')
  @ApiOperation({ summary: 'Estabelecimentos próximos (PostGIS)' })
  getNearbyEstablishments(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.service.getNearbyEstablishments(parseFloat(lat), parseFloat(lng), radius ? parseFloat(radius) : 50);
  }

  @Public()
  @Get('cidades')
  @ApiOperation({ summary: 'Mapa de todas as cidades' })
  getCitiesMap() {
    return this.service.getCitiesMap();
  }

  @Public()
  @Get('distance')
  @ApiOperation({ summary: 'Calcula distância entre dois pontos (PostGIS)' })
  calculateDistance(
    @Query('lat1') lat1: string,
    @Query('lng1') lng1: string,
    @Query('lat2') lat2: string,
    @Query('lng2') lng2: string,
  ) {
    return this.service.calculateDistance(parseFloat(lat1), parseFloat(lng1), parseFloat(lat2), parseFloat(lng2));
  }
}
