import { Module } from '@nestjs/common';
import { FavoritesController } from './favoritos.controller';
import { FavoritesService } from './favoritos.service';
@Module({ controllers: [FavoritesController], providers: [FavoritesService], exports: [FavoritesService] })
export class FavoritesModule {}
