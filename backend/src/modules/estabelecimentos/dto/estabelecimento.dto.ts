import {
  IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateEstablishmentDto {
  @ApiProperty({ example: 'Pousada do Sol' })
  @IsString()
  nome: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ example: '84999999999' })
  @IsOptional()
  @IsString()
  contato?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailContato?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endereco?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;

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

  @ApiProperty({ description: 'ID da cidade' })
  @IsUUID()
  cidadeId: string;

  @ApiPropertyOptional({ description: 'Nome do arquivo de foto de perfil' })
  @IsOptional()
  @IsString()
  fotoPerfil?: string;

  @ApiPropertyOptional({ type: [String], description: 'IDs das comodidades' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  amenityIds?: string[];
}

export class UpdateEstablishmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contato?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailContato?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endereco?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cep?: string;

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

  @ApiPropertyOptional({ description: 'ID da cidade' })
  @IsOptional()
  @IsUUID()
  cidadeId?: string;

  @ApiPropertyOptional({ description: 'Nome do arquivo de foto de perfil' })
  @IsOptional()
  @IsString()
  fotoPerfil?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  amenityIds?: string[];
}

export class BuscaEstabelecimentosDto {

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)
  adminView?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cidadeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radiusKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional({ description: 'IDs das comodidades separados por vírgula' })
  @IsOptional()
  @IsString()
  amenityIds?: string;

  @ApiPropertyOptional({ description: 'IDs dos tipos de acomodação separados por vírgula' })
  @IsOptional()
  @IsString()
  accommodationTypeIds?: string;
}
