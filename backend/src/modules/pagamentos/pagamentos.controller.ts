import { Controller, Get, Post, Body, Param, Query, Headers, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './pagamentos.service';
import { CreatePaymentDto, CreateMercadoPagoCheckoutDto } from './dto/pagamento.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Pagamentos')
@ApiBearerAuth('JWT-auth')
@Controller('pagamentos')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

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
  @ApiOperation({ summary: 'Re-exibe o checkout Mercado Pago salvo para a reserva' })
  getMercadoPagoCheckout(@Param('reservaId') reservaId: string) {
    return this.service.getMercadoPagoCheckout(reservaId);
  }

  @Post('reserva/:reservaId/checkout-mp')
  @ApiOperation({ summary: 'Gera checkout Mercado Pago (PIX, boleto ou cartão) para a reserva' })
  createMercadoPagoCheckout(
    @Param('reservaId') reservaId: string,
    @Body() dto: CreateMercadoPagoCheckoutDto,
  ) {
    return this.service.createMercadoPagoCheckout(reservaId, dto.metodo);
  }

  @Public()
  @Post('webhooks/mercado-pago')
  @ApiOperation({ summary: 'Webhook de notificação de pagamento do Mercado Pago' })
  async webhookMercadoPago(
    @Query('type') type: string,
    @Query('data.id') dataId: string,
    @Headers('x-signature') xSignature: string,
    @Headers('x-request-id') xRequestId: string,
  ) {
    if (type && type !== 'payment') {
      return { received: true };
    }
    if (!dataId) {
      return { received: false };
    }
    const result = await this.service.handleMercadoPagoWebhook({
      paymentId: dataId,
      xSignature,
      xRequestId,
    });
    return { received: true, processed: result.processed };
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string) {
    return this.service.confirm(id);
  }

  @Post(':id/comprovante')
  @UseInterceptors(FileInterceptor('file'))
  uploadComprovante(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadComprovante(id, file.buffer, file.originalname, file.mimetype);
  }
}