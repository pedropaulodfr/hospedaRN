import { Module } from '@nestjs/common';
import { CitiesController } from './cidades.controller';
import { CitiesService } from './cidades.service';

@Module({
  controllers: [CitiesController],
  providers: [CitiesService],
  exports: [CitiesService],
})
export class CitiesModule {}
