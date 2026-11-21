import {
  Controller, Get, Post, Patch, Body, Param, Query,
  HttpCode, HttpStatus, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReservationsService } from './reservas.service';
import { CreateReservationDto, CancelReservationDto } from './dto/reserva.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Reservas')
@ApiBearerAuth('JWT-auth')
@Controller('reservas')
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Post()
  @Roles(PerfilUsuario.HOSPEDE, PerfilUsuario.ADMIN)
  @ApiOperation({ summary: 'Cria nova reserva' })
  create(@Body() dto: CreateReservationDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista reservas com filtros' })
  @ApiQuery({ name: 'estabelecimentoId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dataInicio', required: false, description: 'YYYY-MM-DD (início do intervalo)' })
  @ApiQuery({ name: 'dataFim', required: false, description: 'YYYY-MM-DD (fim do intervalo)' })
  @ApiQuery({
    name: 'campoData',
    required: false,
    enum: ['estadia', 'solicitacao'],
    description: 'estadia = check-in dentro do intervalo (padrão); solicitacao = criadoEm',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') userRole: string,
    @Query('estabelecimentoId') estabelecimentoId?: string,
    @Query('status') status?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('campoData') campoData?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
  ) {
    const filters: any = { page, limit };
    if (status) filters.status = status;
    if (dataInicio) filters.dataInicio = dataInicio;
    if (dataFim) filters.dataFim = dataFim;
    if (campoData) filters.campoData = campoData;
    if (userRole === 'HOSPEDE') filters.hospedeId = userId;
    if (userRole === 'ESTABELECIMENTO' && estabelecimentoId) filters.estabelecimentoId = estabelecimentoId;
    if (userRole === 'ADMIN' && estabelecimentoId) filters.estabelecimentoId = estabelecimentoId;
    return this.service.findAll(filters);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Busca reserva por código' })
  findByCode(@Param('code') code: string) {
    return this.service.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma reserva' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/confirm')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiOperation({ summary: '[ESTABLISHMENT/ADMIN] Confirma reserva' })
  confirm(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') userRole: string,
  ) {
    return this.service.confirm(id, userId, userRole);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancela reserva' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') userRole: string,
  ) {
    return this.service.cancel(id, dto, userId, userRole);
  }

  @Patch(':id/finalize')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiOperation({ summary: '[ESTABLISHMENT/ADMIN] Finaliza reserva' })
  finalize(@Param('id') id: string) {
    return this.service.finalize(id);
  }
}
