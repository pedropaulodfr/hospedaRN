import { IsString, IsOptional, IsDate, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateEventDto {
  @ApiProperty({ example: 'Carnatal 2026' })
  @IsString()
  nome: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkOficial?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  dataInicio: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  dataFim: Date;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  cityIds?: string[];
}
