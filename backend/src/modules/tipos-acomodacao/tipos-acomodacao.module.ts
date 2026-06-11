import { Module } from '@nestjs/common';
import { TiposAcomodacaoController } from './tipos-acomodacao.controller';
import { TiposAcomodacaoService } from './tipos-acomodacao.service';
@Module({ controllers: [TiposAcomodacaoController], providers: [TiposAcomodacaoService], exports: [TiposAcomodacaoService] })
export class TiposAcomodacaoModule {}
