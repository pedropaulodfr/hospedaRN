import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFotoDto {
  @ApiProperty() @IsString() url: string;
  @ApiProperty() @IsString() s3Key: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() estabelecimentoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() quartoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCapa?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() ordem?: number;
}
