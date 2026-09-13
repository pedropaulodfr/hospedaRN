import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaymentsController } from './pagamentos.controller';
import { PaymentsService } from './pagamentos.service';
import { UploadsModule } from '../uploads/uploads.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MercadoPagoModule } from '../mercado-pago/mercado-pago.module';
@Module({ imports: [MulterModule.register({ storage: memoryStorage() }), UploadsModule, NotificationsModule, MercadoPagoModule], controllers: [PaymentsController], providers: [PaymentsService], exports: [PaymentsService] })
export class PaymentsModule {}
