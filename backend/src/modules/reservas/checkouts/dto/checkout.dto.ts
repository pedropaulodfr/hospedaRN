import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FORMATO_DATA } from '../../checkins/dto/checkin.dto';

/**
 * Situações da central de check-out. Não são persistidas: são derivadas do
 * `CheckOut` (a decisão de produto foi manter `StatusReserva` intocado — o
 * encerramento da hospedagem é a existência do `CheckOut`, não o status).
 */
export const SITUACOES_CHECKOUT = [
  'TODOS',
  'EM_ANDAMENTO',
  'SAIDAS_HOJE',
  'ATRASADOS',
  'REALIZADOS',
] as const;
export type SituacaoCheckoutFiltro = (typeof SITUACOES_CHECKOUT)[number];

const MENSAGEM_FORMATO_DATA = 'Data deve estar no formato YYYY-MM-DD';
const MENSAGEM_DATA_INVALIDA = 'Data inválida';

/**
 * Query da central `GET /checkouts`.
 *
 * `estabelecimentoId` nunca amplia o escopo: para ESTABELECIMENTO ele só
 * estreita dentro dos estabelecimentos resolvidos no banco (dono ou vínculo).
 */
export class ListCheckoutsQueryDto {
  @ApiPropertyOptional({
    description:
      'Estabelecimento a filtrar. Só aceito para ADMIN ou para um estabelecimento do próprio escopo.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'estabelecimentoId deve ser um UUID válido' })
  estabelecimentoId?: string;

  @ApiPropertyOptional({ enum: SITUACOES_CHECKOUT, default: 'TODOS' })
  @IsOptional()
  @IsIn(SITUACOES_CHECKOUT, {
    message: `situacao deve ser uma de: ${SITUACOES_CHECKOUT.join(', ')}`,
  })
  situacao?: SituacaoCheckoutFiltro = 'TODOS';

  @ApiPropertyOptional({
    example: '2026-11-20',
    description:
      'Saída prevista ou check-out realizado neste dia (dia operacional)',
  })
  @IsOptional()
  @IsString()
  @Matches(FORMATO_DATA, { message: MENSAGEM_FORMATO_DATA })
  @IsDateString({ strict: true }, { message: MENSAGEM_DATA_INVALIDA })
  data?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Início do intervalo de saída prevista',
  })
  @IsOptional()
  @IsString()
  @Matches(FORMATO_DATA, { message: MENSAGEM_FORMATO_DATA })
  @IsDateString({ strict: true }, { message: MENSAGEM_DATA_INVALIDA })
  de?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Fim do intervalo de saída prevista (inclusivo)',
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

/** Body de `POST /checkouts`. */
export class CreateCheckOutDto {
  @ApiProperty({ description: 'Reserva que está realizando o check-out' })
  @IsUUID('all', { message: 'reservaId deve ser um UUID válido' })
  reservaId: string;

  @ApiPropertyOptional({
    description:
      'Data e hora do check-out em ISO 8601 (ex.: 2026-11-20T10:30:00.000Z). Se omitida, o servidor registra o horário atual.',
  })
  @IsOptional()
  @IsString()
  @IsDateString({}, { message: 'Data e hora do check-out inválida' })
  realizadoEm?: string;

  @ApiPropertyOptional({
    description: 'Observações da recepção (máx. 1000 caracteres)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;
}
