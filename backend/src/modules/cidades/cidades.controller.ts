import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, HttpCode, HttpStatus, DefaultValuePipe, ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CitiesService } from './cidades.service';
import { CreateCityDto, UpdateCityDto } from './dto/cidade.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Cidades')
@Controller('cidades')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista todas as cidades' })
  @ApiQuery({ name: 'ativo', required: false, type: Boolean })
  findAll(@Query('ativo') ativo?: string) {
    const atoBoolean = ativo !== undefined ? ativo === 'true' : undefined;
    return this.citiesService.findAll(atoBoolean);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Busca cidades próximas por coordenadas (PostGIS)' })
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.citiesService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : 50,
    );
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Busca cidade por ID' })
  findOne(@Param('id') id: string) {
    return this.citiesService.findOne(id);
  }

  @Post()
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Cria nova cidade' })
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Atualiza cidade' })
  update(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.citiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Remove cidade' })
  remove(@Param('id') id: string) {
    return this.citiesService.remove(id);
  }
}
