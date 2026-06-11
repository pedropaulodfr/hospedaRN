import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favoritos.service';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
@ApiTags('Favoritos')
@ApiBearerAuth('JWT-auth')
@Controller('favoritos')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}
  @Get() findMyFavorites(@CurrentUser('sub') userId: string) { return this.service.findByUser(userId); }
  @Post(':estabelecimentoId') toggle(@Param('estabelecimentoId') id: string, @CurrentUser('sub') userId: string) { return this.service.toggle(userId, id); }
}
