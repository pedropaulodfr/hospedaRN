import { IsString, IsEmail, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PerfilUsuario } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ example: '84999999999' })
  @IsOptional()
  @IsString()
  telefone?: string;
}

export class UpdateUserRoleDto {
  @ApiPropertyOptional({ enum: PerfilUsuario })
  @IsEnum(PerfilUsuario)
  perfil: PerfilUsuario;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsString()
  senhaAtual: string;

  @ApiPropertyOptional()
  @IsString()
  novaSenha: string;
}
