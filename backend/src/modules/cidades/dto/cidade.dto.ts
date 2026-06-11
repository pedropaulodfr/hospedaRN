import { IsString, IsOptional, IsBoolean, IsDecimal, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCityDto {
  @ApiProperty({ example: 'Natal' })
  @IsString()
  nome: string;

  @ApiPropertyOptional({ example: 'RN', default: 'RN' })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiProperty({ example: -5.7945 })
  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @ApiProperty({ example: -35.2110 })
  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ description: 'Nome do arquivo de foto de perfil da cidade' })
  @IsOptional()
  @IsString()
  fotoPerfil?: string;
}

export class UpdateCityDto {
  @ApiPropertyOptional({ example: 'Natal' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ example: 'RN' })
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ description: 'Nome do arquivo de foto de perfil da cidade' })
  @IsOptional()
  @IsString()
  fotoPerfil?: string;
}
