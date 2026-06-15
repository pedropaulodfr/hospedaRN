import { IsString, IsOptional, IsNumber, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRegraTopicoDto {
  @ApiProperty({ example: 'Check-in' }) @IsString() label: string;
  @ApiPropertyOptional({ example: 'a partir das 14:00h' }) @IsOptional() @IsString() valor?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) ordem?: number;
}

export class CreateRegraSecaoDto {
  @ApiProperty({ example: 'Horários' }) @IsString() nome: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateRegraTopicoDto) topicos?: CreateRegraTopicoDto[];
}

export class UpdateRegraTopicoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() valor?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) ordem?: number;
}

export class UpdateRegraSecaoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nome?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Type(() => Number) ordem?: number;
}
