import { Module } from '@nestjs/common';
import { EventsController } from './eventos.controller';
import { EventsService } from './eventos.service';
@Module({ controllers: [EventsController], providers: [EventsService], exports: [EventsService] })
export class EventsModule {}
