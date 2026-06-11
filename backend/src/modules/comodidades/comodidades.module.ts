import { Module } from '@nestjs/common';
import { AmenitiesController } from './comodidades.controller';
import { AmenitiesService } from './comodidades.service';

@Module({
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
