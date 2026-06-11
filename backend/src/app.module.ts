import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/usuarios/usuarios.module';
import { CitiesModule } from './modules/cidades/cidades.module';
import { EstablishmentsModule } from './modules/estabelecimentos/estabelecimentos.module';
import { AmenitiesModule } from './modules/comodidades/comodidades.module';
import { TiposAcomodacaoModule } from './modules/tipos-acomodacao/tipos-acomodacao.module';
import { RoomsModule } from './modules/quartos/quartos.module';
import { ReservationsModule } from './modules/reservas/reservas.module';
import { PaymentsModule } from './modules/pagamentos/pagamentos.module';
import { EventsModule } from './modules/eventos/eventos.module';
import { ReviewsModule } from './modules/avaliacoes/avaliacoes.module';
import { FavoritesModule } from './modules/favoritos/favoritos.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { MapsModule } from './modules/maps/maps.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60') * 1000,
        limit: parseInt(process.env.RATE_LIMIT_LIMIT || '100'),
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CitiesModule,
    EstablishmentsModule,
    AmenitiesModule,
    TiposAcomodacaoModule,
    RoomsModule,
    ReservationsModule,
    PaymentsModule,
    EventsModule,
    ReviewsModule,
    FavoritesModule,
    NotificationsModule,
    UploadsModule,
    ReportsModule,
    AuditModule,
    MapsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
