import { Module } from '@nestjs/common';
import { RoomsController } from './quartos.controller';
import { RoomsService } from './quartos.service';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
