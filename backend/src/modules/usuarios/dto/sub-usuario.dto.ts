import { IsString, IsEmail, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubUserDto {
  @ApiProperty({ example: 'João Assistente' })
  @IsString()
  nome: string;

  @ApiProperty({ example: 'joao.assistente@email.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Operacional' })
  @IsOptional()
  @IsString()
  subPerfil?: string;

  @ApiPropertyOptional({ example: ['ADMIN_CITIES', 'ADMIN_EVENTS'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissoes?: string[];
  
  @ApiPropertyOptional({ description: 'ID do Estabelecimento vinculado (opcional)' })
  @IsOptional()
  @IsUUID()
  estabelecimentoVinculadoId?: string;
}

export class UpdateSubUserDto {
  @ApiPropertyOptional({ example: 'João Assistente Atualizado' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ example: 'Operacional' })
  @IsOptional()
  @IsString()
  subPerfil?: string;

  @ApiPropertyOptional({ example: ['ADMIN_CITIES'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissoes?: string[];
}
