import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TiposAcomodacaoService } from './tipos-acomodacao.service';
import { CreateTipoAcomodacaoDto } from './dto/tipo-acomodacao.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { PerfilUsuario } from '@prisma/client';
@ApiTags('Tipos de Acomodacao')
@Controller('tipos-acomodacao')
export class TiposAcomodacaoController {
  constructor(private readonly service: TiposAcomodacaoService) {}
  @Public() @Get() findAll() { return this.service.findAll(); }
  @Get('estabelecimento/:id') findByEstablishment(@Param('id') id: string) { return this.service.findByEstablishment(id); }
  @Post() @Roles(PerfilUsuario.ADMIN, PerfilUsuario.ESTABELECIMENTO) @ApiBearerAuth('JWT-auth')
  create(@Body() dto: CreateTipoAcomodacaoDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }
  @Patch(':id') @Roles(PerfilUsuario.ADMIN) @ApiBearerAuth('JWT-auth') update(@Param('id') id: string, @Body() dto: Partial<CreateTipoAcomodacaoDto>) { return this.service.update(id, dto); }
  @Delete(':id') @Roles(PerfilUsuario.ADMIN) @ApiBearerAuth('JWT-auth') @HttpCode(HttpStatus.OK) remove(@Param('id') id: string) { return this.service.remove(id); }
}
