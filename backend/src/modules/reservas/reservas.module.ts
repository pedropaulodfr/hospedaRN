import { Module } from '@nestjs/common';
import { ReservationsController } from './reservas.controller';
import { ReservationsService } from './reservas.service';
import { CheckinsController } from './checkins/checkins.controller';
import { CheckinsService } from './checkins/checkins.service';
import { CheckoutsController } from './checkouts/checkouts.controller';
import { CheckoutsService } from './checkouts/checkouts.service';
import { RoomsModule } from '../quartos/quartos.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RoomsModule, NotificationsModule],
  // O check-in vive dentro do módulo de reservas (mesmo domínio); a auditoria é
  // gravada direto na transação (`tx.logAuditoria`), sem depender do AuditModule.
  controllers: [
    ReservationsController,
    CheckinsController,
    CheckoutsController,
  ],
  providers: [ReservationsService, CheckinsService, CheckoutsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
