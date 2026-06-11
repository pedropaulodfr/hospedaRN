import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './eventos.service';
import { CreateEventDto } from './dto/evento.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Eventos')
@Controller('eventos')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Public() @Get()
  @ApiOperation({ summary: 'Lista eventos ativos' })
  findAll(@Query('upcoming') upcoming?: string) {
    return this.service.findAll(upcoming === 'true');
  }

  @Public() @Get('cidade/:cidadeId')
  @ApiOperation({ summary: 'Eventos por cidade' })
  findByCity(@Param('cidadeId') cidadeId: string) { return this.service.findByCity(cidadeId); }

  @Public() @Get(':id')
  @ApiOperation({ summary: 'Detalhes do evento' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Cria evento' })
  create(@Body() dto: CreateEventDto) { return this.service.create(dto); }

  @Patch(':id')
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[ADMIN] Atualiza evento' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateEventDto>) { return this.service.update(id, dto); }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Remove evento' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
