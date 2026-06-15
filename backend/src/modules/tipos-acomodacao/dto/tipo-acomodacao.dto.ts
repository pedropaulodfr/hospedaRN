import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreateTipoAcomodacaoDto {
  @ApiProperty({ example: 'Quarto Duplo' }) @IsString() nome: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descricao?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() estabelecimentoId?: string;
}
