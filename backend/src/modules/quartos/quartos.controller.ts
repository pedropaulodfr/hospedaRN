import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomsService } from './quartos.service';
import { CreateRoomDto, UpdateRoomDto, CreateRoomPriceDto, CreateDateBlockDto } from './dto/quarto.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Quartos')
@Controller('quartos')
export class RoomsController {
  constructor(private readonly service: RoomsService) {}

  @Public()
  @Get('estabelecimento/:estabelecimentoId')
  @ApiOperation({ summary: 'Lista quartos de um estabelecimento' })
  findByEstablishment(@Param('estabelecimentoId') id: string) {
    return this.service.findByEstablishment(id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um quarto' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Public()
  @Get(':id/availability')
  @ApiOperation({ summary: 'Verifica disponibilidade do quarto' })
  checkAvailability(
    @Param('id') id: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.service.checkAvailability(id, new Date(checkIn), new Date(checkOut));
  }

  @Public()
  @Get(':id/preco')
  @ApiOperation({ summary: 'Calcula preço para período' })
  calculatePrice(
    @Param('id') id: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.service.calculatePrice(id, new Date(checkIn), new Date(checkOut));
  }

  @Post()
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cria quarto em um estabelecimento' })
  create(
    @Body() dto: CreateRoomDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') userRole: string,
  ) {
    return this.service.create(dto, userId, userRole);
  }

  @Patch(':id')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Atualiza quarto' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') userRole: string,
  ) {
    return this.service.update(id, dto, userId, userRole);
  }

  @Post(':id/precos')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Define preço por temporada' })
  setPrice(@Param('id') id: string, @Body() dto: CreateRoomPriceDto) {
    return this.service.setPrice(id, dto);
  }

  @Post(':id/block')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Bloqueia data do quarto' })
  blockDate(@Param('id') id: string, @Body() dto: CreateDateBlockDto) {
    return this.service.blockDate(id, dto);
  }

  @Delete(':id/block/:date')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desbloqueia data do quarto' })
  unblockDate(@Param('id') id: string, @Param('date') date: string) {
    return this.service.unblockDate(id, date);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove quarto' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
