import { Module } from '@nestjs/common';
import { EstablishmentsController } from './estabelecimentos.controller';
import { EstablishmentsService } from './estabelecimentos.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EstablishmentsController],
  providers: [EstablishmentsService],
  exports: [EstablishmentsService],
})
export class EstablishmentsModule {}
