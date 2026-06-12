import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FotosService } from './fotos.service';
import { CreateFotoDto } from './dto/create-foto.dto';
import { UpdateFotoDto } from './dto/update-foto.dto';

@ApiTags('Fotos')
@ApiBearerAuth('JWT-auth')
@Controller('fotos')
export class FotosController {
  constructor(private readonly service: FotosService) {}

  @Post()
  @ApiOperation({ summary: 'Cria registro de foto' })
  create(@Body() dto: CreateFotoDto) { return this.service.create(dto); }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza foto (capa, ordem)' })
  update(@Param('id') id: string, @Body() dto: UpdateFotoDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove foto' })
  delete(@Param('id') id: string) { return this.service.delete(id); }

  @Get('estabelecimento/:id')
  @ApiOperation({ summary: 'Lista fotos de um estabelecimento' })
  findByEstablishment(@Param('id') id: string) { return this.service.findByEstablishment(id); }

  @Get('quarto/:id')
  @ApiOperation({ summary: 'Lista fotos de um quarto' })
  findByRoom(@Param('id') id: string) { return this.service.findByRoom(id); }
}
