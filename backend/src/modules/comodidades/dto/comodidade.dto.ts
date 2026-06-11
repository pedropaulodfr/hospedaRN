import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAmenityDto {
  @ApiProperty({ example: 'Wi-Fi' })
  @IsString()
  nome: string;

  @ApiPropertyOptional({ example: 'wifi' })
  @IsOptional()
  @IsString()
  icone?: string;
}

export class UpdateAmenityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icone?: string;
}
