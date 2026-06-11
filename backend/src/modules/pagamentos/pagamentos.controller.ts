import { Controller, Get, Post, Body, Param, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './pagamentos.service';
import { CreatePaymentDto } from './dto/pagamento.dto';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
@ApiTags('Pagamentos')
@ApiBearerAuth('JWT-auth')
@Controller('pagamentos')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Post() create(@Body() dto: CreatePaymentDto) { return this.service.create(dto); }
  @Get('reserva/:id') findByReservation(@Param('id') id: string) { return this.service.findByReservation(id); }
  @Get('pix/:reservaId') generatePix(@Param('reservaId') id: string) { return this.service.generatePix(id); }
  @Post(':id/confirm') confirm(@Param('id') id: string) { return this.service.confirm(id); }
  @Post(':id/comprovante')
  @UseInterceptors(FileInterceptor('file'))
  uploadComprovante(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadComprovante(id, file.buffer, file.originalname);
  }
}
