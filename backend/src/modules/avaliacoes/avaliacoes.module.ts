import { Module } from '@nestjs/common';
import { ReviewsController } from './avaliacoes.controller';
import { ReviewsService } from './avaliacoes.service';
@Module({ controllers: [ReviewsController], providers: [ReviewsService], exports: [ReviewsService] })
export class ReviewsModule {}
