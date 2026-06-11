import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EstablishmentsService } from './estabelecimentos.service';
import {
  CreateEstablishmentDto,
  UpdateEstablishmentDto,
  BuscaEstabelecimentosDto,
} from './dto/estabelecimento.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Estabelecimentos')
@Controller('estabelecimentos')
export class EstablishmentsController {
  constructor(private readonly service: EstablishmentsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista estabelecimentos ativos com filtros' })
  findAll(@Query() dto: BuscaEstabelecimentosDto) {
    return this.service.findAll(dto);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Estabelecimentos próximos por coordenadas (PostGIS)' })
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.service.findNearby(parseFloat(lat), parseFloat(lng), radius ? parseFloat(radius) : 50);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um estabelecimento' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('proprietario/my')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lista estabelecimentos do proprietário autenticado' })
  findByOwner(@CurrentUser('sub') proprietarioId: string) {
    return this.service.findByOwner(proprietarioId);
  }

  @Post()
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Cria novo estabelecimento com auto-criação de proprietário' })
  create(
    @Body() dto: CreateEstablishmentDto,
  ) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Atualiza estabelecimento' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEstablishmentDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') userRole: string,
  ) {
    return this.service.update(id, dto, userId, userRole);
  }


  @Patch(':id/toggle-active')
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Ativa/desativa estabelecimento' })
  toggleActive(@Param('id') id: string) {
    return this.service.toggleActive(id);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Remove estabelecimento' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
