import { IsNumber, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
export class CreateReviewDto {
  @ApiProperty() @IsUUID() reservaId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsNumber() @Min(1) @Max(5) @Type(() => Number) nota: number;
  @ApiPropertyOptional() @IsOptional() @IsString() comentario?: string;
}
