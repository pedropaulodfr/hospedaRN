import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './pagamentos.service';
import { PagamentosReconciliacaoService } from './pagamentos-reconciliacao.service';
import {
  CreatePaymentDto,
  CreateMercadoPagoCheckoutDto,
} from './dto/pagamento.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Pagamentos')
@ApiBearerAuth('JWT-auth')
@Controller('pagamentos')
export class PaymentsController {
  constructor(
    private readonly service: PaymentsService,
    private readonly reconciliacao: PagamentosReconciliacaoService,
  ) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.service.create(dto);
  }

  @Get('reserva/:id')
  findByReservation(@Param('id') id: string) {
    return this.service.findByReservation(id);
  }

  @Get('pix/:reservaId')
  generatePix(@Param('reservaId') id: string) {
    return this.service.generatePix(id);
  }

  @Get('checkout/:reservaId')
  @ApiOperation({
    summary: 'Re-exibe o checkout Mercado Pago salvo para a reserva',
  })
  getMercadoPagoCheckout(@Param('reservaId') reservaId: string) {
    return this.service.getMercadoPagoCheckout(reservaId);
  }

  @Post('reserva/:reservaId/checkout-mp')
  @ApiOperation({
    summary: 'Gera checkout Mercado Pago (PIX, boleto ou cartão) para a reserva',
  })
  createMercadoPagoCheckout(
    @Param('reservaId') reservaId: string,
    @Body() dto: CreateMercadoPagoCheckoutDto,
  ) {
    return this.service.createMercadoPagoCheckout(reservaId, dto.metodo);
  }

  @Post('reserva/:reservaId/sincronizar')
  @ApiOperation({
    summary:
      'Consulta o Mercado Pago e reconhece o pagamento automaticamente (fallback do webhook)',
  })
  syncMercadoPagoPayment(
    @Param('reservaId') reservaId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') userRole: string,
  ) {
    return this.service.syncMercadoPagoPayment(reservaId, userId, userRole);
  }

  @Public()
  @Post('webhooks/mercado-pago')
  @ApiOperation({
    summary: 'Webhook de notificação de pagamento do Mercado Pago',
  })
  async webhookMercadoPago(
    @Query('type') type: string,
    @Query('topic') topic: string,
    @Query('data.id') dataId: string,
    @Query('id') id: string,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
    @Body() body: { type?: string; action?: string; data?: { id?: string | number } },
  ) {
    const tipo = type || topic || body?.type || body?.action;
    const paymentId =
      dataId || id || (body?.data?.id != null ? String(body.data.id) : undefined);

    // O Mercado Pago envia também notificações de merchant_order e de
    // subscription; só o tópico de pagamento interessa aqui.
    if (tipo && !String(tipo).includes('payment')) {
      return { received: true };
    }
    if (!paymentId) {
      return { received: true, processed: false };
    }

    const result = await this.service.handleMercadoPagoWebhook({
      paymentId,
      xSignature,
      xRequestId,
    });
    return { received: true, processed: result.processed };
  }

  @Post('reconciliar')
  @Roles(PerfilUsuario.ADMIN)
  @ApiOperation({
    summary:
      'Executa agora a reconciliação dos pagamentos Mercado Pago pendentes (gestor)',
  })
  reconciliar(
    @Query('lote') lote?: string,
    @Query('janelaHoras') janelaHoras?: string,
  ) {
    return this.reconciliacao.executarCiclo({
      lote: lote ? Number(lote) : undefined,
      janelaHoras: janelaHoras ? Number(janelaHoras) : undefined,
    });
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirm(id);
  }

  @Post(':id/comprovante')
  @UseInterceptors(FileInterceptor('file'))
  uploadComprovante(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Arquivo do comprovante não enviado (campo esperado: file)',
      );
    }
    return this.service.uploadComprovante(
      id,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }
}
