import { IsEnum, IsUUID, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetodoPagamento } from '@prisma/client';
export class CreatePaymentDto {
  @ApiProperty() @IsUUID() reservaId: string;
  @ApiProperty({ enum: MetodoPagamento }) @IsEnum(MetodoPagamento) metodo: MetodoPagamento;
  @ApiPropertyOptional() @IsOptional() @IsString() codigoTransacao?: string;
}

export class CreateMercadoPagoCheckoutDto {
  @ApiProperty({
    enum: ['PIX', 'BOLETO', 'CARTAO'],
    description: 'Método de pagamento via Mercado Pago',
  })
  @IsIn(['PIX', 'BOLETO', 'CARTAO'])
  metodo: 'PIX' | 'BOLETO' | 'CARTAO';
}
