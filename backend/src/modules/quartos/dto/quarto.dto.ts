import { IsString, IsOptional, IsNumber, IsUUID, IsDate, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @ApiProperty({ example: 'Quarto Standard' })
  @IsString()
  nome: string;

  @ApiProperty()
  @IsUUID()
  estabelecimentoId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tipoAcomodacaoId?: string;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  capacidade?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quantidade?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty({ example: 150.00 })
  @IsNumber()
  @Type(() => Number)
  precoBase: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class UpdateRoomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tipoAcomodacaoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  capacidade?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quantidade?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  precoBase?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class CreateRoomPriceDto {
  @ApiProperty()
  @IsUUID()
  temporadaId: string;

  @ApiProperty({ example: 200.00 })
  @IsNumber()
  @Type(() => Number)
  valor: number;
}

export class CreateDateBlockDto {
  @ApiProperty({ example: '2026-12-25' })
  @Type(() => Date)
  @IsDate()
  data: Date;

  @ApiPropertyOptional({ example: 'Manutenção' })
  @IsOptional()
  @IsString()
  motivo?: string;
}
