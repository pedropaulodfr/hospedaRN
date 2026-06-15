import { Module } from '@nestjs/common';
import { ReservationsController } from './reservas.controller';
import { ReservationsService } from './reservas.service';
import { RoomsModule } from '../quartos/quartos.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RoomsModule, NotificationsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
