import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RegrasService } from './regras.service';
import { CreateRegraSecaoDto, CreateRegraTopicoDto, UpdateRegraSecaoDto, UpdateRegraTopicoDto } from './dto/regra.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Regras')
@ApiBearerAuth('JWT-auth')
@Controller('regras')
export class RegrasController {
  constructor(private readonly service: RegrasService) {}

  @Get('estabelecimento/:id')
  findByEstablishment(@Param('id') id: string) {
    return this.service.findByEstablishment(id);
  }

  @Post('secao/:estabelecimentoId')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  createSecao(@Param('estabelecimentoId') estabelecimentoId: string, @Body() dto: CreateRegraSecaoDto) {
    return this.service.createSecao(estabelecimentoId, dto);
  }

  @Patch('secao/:id')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  updateSecao(@Param('id') id: string, @Body() dto: UpdateRegraSecaoDto) {
    return this.service.updateSecao(id, dto);
  }

  @Delete('secao/:id')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteSecao(@Param('id') id: string) {
    return this.service.deleteSecao(id);
  }

  @Post('topico/:secaoId')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  createTopico(@Param('secaoId') secaoId: string, @Body() dto: CreateRegraTopicoDto) {
    return this.service.createTopico(secaoId, dto);
  }

  @Patch('topico/:id')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  updateTopico(@Param('id') id: string, @Body() dto: UpdateRegraTopicoDto) {
    return this.service.updateTopico(id, dto);
  }

  @Delete('topico/:id')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteTopico(@Param('id') id: string) {
    return this.service.deleteTopico(id);
  }
}
