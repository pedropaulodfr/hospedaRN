import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerfilUsuario } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  nome: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  senha: string;

  @ApiProperty({ example: '84999999999' })
  @IsString()
  telefone: string;

  @ApiProperty({ example: '123.456.789-00' })
  @IsString()
  cpf: string;

  @ApiProperty({ example: '1995-10-25' })
  @IsString()
  dataNascimento: string;

  @ApiPropertyOptional({ example: '1.234.567' })
  @IsOptional()
  @IsString()
  rg?: string;

  @ApiPropertyOptional({ example: 'Brasileira' })
  @IsOptional()
  @IsString()
  nacionalidade?: string;

  @ApiPropertyOptional({ example: 'Maria (84) 98888-8888' })
  @IsOptional()
  @IsString()
  contatoEmergencia?: string;

  @ApiPropertyOptional({ example: 'Rua das Flores, 123, Natal - RN' })
  @IsOptional()
  @IsString()
  endereco?: string;

  @ApiPropertyOptional({ enum: PerfilUsuario, default: PerfilUsuario.HOSPEDE })
  @IsOptional()
  @IsEnum(PerfilUsuario)
  perfil?: PerfilUsuario;
}

export class LoginDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  senha: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  novaSenha: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}
