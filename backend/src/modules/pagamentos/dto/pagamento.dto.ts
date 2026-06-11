import { IsEnum, IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetodoPagamento } from '@prisma/client';
export class CreatePaymentDto {
  @ApiProperty() @IsUUID() reservaId: string;
  @ApiProperty({ enum: MetodoPagamento }) @IsEnum(MetodoPagamento) metodo: MetodoPagamento;
  @ApiPropertyOptional() @IsOptional() @IsString() codigoTransacao?: string;
}
