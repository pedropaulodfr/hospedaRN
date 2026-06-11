import { IsUUID, IsDate, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @ApiProperty()
  @IsUUID()
  estabelecimentoId: string;

  @ApiProperty()
  @IsUUID()
  quartoId: string;

  @ApiProperty({ example: '2026-07-10' })
  @Type(() => Date)
  @IsDate()
  checkIn: Date;

  @ApiProperty({ example: '2026-07-15' })
  @Type(() => Date)
  @IsDate()
  checkOut: Date;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  adultos?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  criancas?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class CancelReservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;
}
