import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Situações da central de check-in. Não são persistidas: são derivadas do
 * `CheckIn` (a decisão de produto foi manter `StatusReserva` intocado).
 */
export const SITUACOES_CHECKIN = [
  'TODOS',
  'PENDENTES',
  'REALIZADOS',
  'ATRASADOS',
] as const;
export type SituacaoCheckInFiltro = (typeof SITUACOES_CHECKIN)[number];

/** Datas de entrada (query/body) sempre no formato `YYYY-MM-DD`. */
export const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MENSAGEM_FORMATO_DATA = 'Data deve estar no formato YYYY-MM-DD';
const MENSAGEM_DATA_INVALIDA = 'Data inválida';

/**
 * Query da central `GET /checkins`.
 *
 * `estabelecimentoId` nunca amplia o escopo: para ESTABELECIMENTO ele só
 * estreita dentro dos estabelecimentos resolvidos no banco (dono ou vínculo).
 */
export class ListCheckinsQueryDto {
  @ApiPropertyOptional({
    description:
      'Estabelecimento a filtrar. Só aceito para ADMIN ou para um estabelecimento do próprio escopo.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'estabelecimentoId deve ser um UUID válido' })
  estabelecimentoId?: string;

  @ApiPropertyOptional({ enum: SITUACOES_CHECKIN, default: 'TODOS' })
  @IsOptional()
  @IsIn(SITUACOES_CHECKIN, {
    message: `situacao deve ser uma de: ${SITUACOES_CHECKIN.join(', ')}`,
  })
  situacao?: SituacaoCheckInFiltro = 'TODOS';

  @ApiPropertyOptional({
    example: '2026-11-20',
    description: 'Chegada prevista ou check-in realizado neste dia',
  })
  @IsOptional()
  @IsString()
  @Matches(FORMATO_DATA, { message: MENSAGEM_FORMATO_DATA })
  @IsDateString({ strict: true }, { message: MENSAGEM_DATA_INVALIDA })
  data?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Início do intervalo de chegada prevista',
  })
  @IsOptional()
  @IsString()
  @Matches(FORMATO_DATA, { message: MENSAGEM_FORMATO_DATA })
  @IsDateString({ strict: true }, { message: MENSAGEM_DATA_INVALIDA })
  de?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Fim do intervalo de chegada prevista (inclusivo)',
  })
  @IsOptional()
  @IsString()
  @Matches(FORMATO_DATA, { message: MENSAGEM_FORMATO_DATA })
  @IsDateString({ strict: true }, { message: MENSAGEM_DATA_INVALIDA })
  ate?: string;

  @ApiPropertyOptional({
    description: 'Código da reserva, nome do hóspede ou nome do quarto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro' })
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um número inteiro' })
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/** Dados do hóspede principal (complemento de cadastro no momento do check-in). */
export class HospedePrincipalDto {
  @ApiPropertyOptional({ example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @ApiPropertyOptional({ example: '1.234.567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rg?: string;

  @ApiPropertyOptional({
    description: 'Documento alternativo ao RG (gravado só no check-in)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  documento?: string;

  @ApiPropertyOptional({ example: '1995-10-25' })
  @IsOptional()
  @IsString()
  @Matches(FORMATO_DATA, { message: MENSAGEM_FORMATO_DATA })
  @IsDateString({ strict: true }, { message: MENSAGEM_DATA_INVALIDA })
  dataNascimento?: string;

  @ApiPropertyOptional({ example: '84999998888' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @ApiPropertyOptional({ example: 'Brasileira' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nacionalidade?: string;
}

/** Acompanhante presente/ausente no check-in. */
export class AcompanhanteDto {
  @ApiProperty({ example: 'Ana Silva' })
  @IsString()
  @IsNotEmpty({ message: 'Acompanhante sem nome' })
  @MaxLength(255)
  nome: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  documento?: string;

  @ApiPropertyOptional({ example: '1992-03-08' })
  @IsOptional()
  @IsString()
  @Matches(FORMATO_DATA, { message: MENSAGEM_FORMATO_DATA })
  @IsDateString({ strict: true }, { message: MENSAGEM_DATA_INVALIDA })
  dataNascimento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @ApiPropertyOptional({ example: 'Cônjuge' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  parentesco?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  presente?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}

/** Body de `POST /checkins`. */
export class CreateCheckInDto {
  @ApiProperty({ description: 'Reserva que está realizando o check-in' })
  @IsUUID('all', { message: 'reservaId deve ser um UUID válido' })
  reservaId: string;

  @ApiPropertyOptional({
    description: 'Observações da recepção (máx. 1000 caracteres)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;

  @ApiPropertyOptional({ type: HospedePrincipalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HospedePrincipalDto)
  hospedePrincipal?: HospedePrincipalDto;

  @ApiPropertyOptional({ type: [AcompanhanteDto], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'No máximo 20 acompanhantes por check-in' })
  @ValidateNested({ each: true })
  @Type(() => AcompanhanteDto)
  acompanhantes?: AcompanhanteDto[];
}
