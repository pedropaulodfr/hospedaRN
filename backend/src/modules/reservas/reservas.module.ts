import { Module } from '@nestjs/common';
import { ReservationsController } from './reservas.controller';
import { ReservationsService } from './reservas.service';
import { RoomsModule } from '../quartos/quartos.module';

@Module({
  imports: [RoomsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
