import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AmenitiesService } from './comodidades.service';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/comodidade.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';
@ApiTags('Comodidades')
@Controller('comodidades')
export class AmenitiesController {
  constructor(private readonly service: AmenitiesService) {}
  @Public() @Get() @ApiOperation({ summary: 'Lista comodidades' }) findAll() { return this.service.findAll(); }
  @Post() @Roles(PerfilUsuario.ADMIN) @ApiBearerAuth('JWT-auth') @ApiOperation({ summary: 'Cria comodidade' }) create(@Body() dto: CreateAmenityDto) { return this.service.create(dto); }
  @Patch(':id') @Roles(PerfilUsuario.ADMIN) @ApiBearerAuth('JWT-auth') update(@Param('id') id: string, @Body() dto: UpdateAmenityDto) { return this.service.update(id, dto); }
  @Delete(':id') @Roles(PerfilUsuario.ADMIN) @ApiBearerAuth('JWT-auth') @HttpCode(HttpStatus.OK) remove(@Param('id') id: string) { return this.service.remove(id); }
}
