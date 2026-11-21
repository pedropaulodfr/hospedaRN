import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PerfilUsuario } from '@prisma/client';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-usuario.decorator';
import { CheckinsService } from './checkins.service';
import {
  CreateCheckInDto,
  ListCheckinsQueryDto,
  SITUACOES_CHECKIN,
} from './dto/checkin.dto';

/**
 * Check-in no módulo do Estabelecimento.
 *
 * Autorização: `@Roles(ESTABELECIMENTO, ADMIN)` em todas as rotas + checagem de
 * posse no service (o JWT não carrega estabelecimento; o escopo é resolvido no
 * banco a partir de `sub`). `@Permissions` não é usado de propósito: o guard
 * correspondente é ineficaz no projeto (R-02).
 */
@ApiTags('Check-in')
@ApiBearerAuth('JWT-auth')
@Controller('checkins')
export class CheckinsController {
  constructor(private readonly service: CheckinsService) {}

  @Get()
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiOperation({
    summary:
      '[ESTABELECIMENTO/ADMIN] Central de check-ins com filtros e resumo',
  })
  @ApiQuery({
    name: 'estabelecimentoId',
    required: false,
    description: 'Só para ADMIN ou para um estabelecimento do próprio escopo',
  })
  @ApiQuery({ name: 'situacao', required: false, enum: SITUACOES_CHECKIN })
  @ApiQuery({ name: 'data', required: false, example: '2026-11-20' })
  @ApiQuery({ name: 'de', required: false, example: '2026-11-01' })
  @ApiQuery({ name: 'ate', required: false, example: '2026-11-30' })
  @ApiQuery({ name: 'busca', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  list(
    @Query() query: ListCheckinsQueryDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') perfil: string,
  ) {
    return this.service.list(query, userId, perfil);
  }

  @Get(':reservaId')
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @ApiOperation({
    summary: '[ESTABELECIMENTO/ADMIN] Pré-check-in / detalhe da reserva',
  })
  @ApiParam({ name: 'reservaId', description: 'ID da reserva' })
  detail(
    @Param('reservaId', new ParseUUIDPipe()) reservaId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') perfil: string,
  ) {
    return this.service.detail(reservaId, userId, perfil);
  }

  @Post()
  @Roles(PerfilUsuario.ESTABELECIMENTO, PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[ESTABELECIMENTO/ADMIN] Registra o check-in da reserva',
  })
  create(
    @Body() dto: CreateCheckInDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('perfil') perfil: string,
    @Ip() enderecoIp: string,
  ) {
    return this.service.create(dto, userId, perfil, enderecoIp);
  }
}
