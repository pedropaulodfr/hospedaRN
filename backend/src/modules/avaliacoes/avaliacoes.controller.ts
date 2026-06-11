import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './avaliacoes.service';
import { CreateReviewDto } from './dto/avaliacao.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { PerfilUsuario } from '@prisma/client';
@ApiTags('Avaliacoes')
@Controller('avaliacoes')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}
  @Public() @Get('estabelecimento/:id') findByEstablishment(@Param('id') id: string) { return this.service.findByEstablishment(id); }
  @Post() @Roles(PerfilUsuario.HOSPEDE) @ApiBearerAuth('JWT-auth') @ApiOperation({ summary: 'Criar avaliacao' })
  create(@Body() dto: CreateReviewDto, @CurrentUser('sub') userId: string) { return this.service.create(dto, userId); }
}
