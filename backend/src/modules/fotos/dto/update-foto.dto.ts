import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFotoDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isCapa?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() ordem?: number;
}
