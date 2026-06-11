import {
  Controller, Get, Patch, Delete, Body, Param, Query, Post,
  HttpCode, HttpStatus, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './usuarios.service';
import { UpdateUserDto, UpdateUserRoleDto, ChangePasswordDto } from './dto/usuario.dto';
import { CreateSubUserDto, UpdateSubUserDto } from './dto/sub-usuario.dto';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PerfilUsuario } from '@prisma/client';

@ApiTags('Usuarios')
@ApiBearerAuth('JWT-auth')
@Controller('usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna o perfil do usuário autenticado' })
  findMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findMe(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualiza perfil do usuário autenticado' })
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Altera senha do usuário autenticado' })
  changePassword(@CurrentUser('sub') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto);
  }

  @Get()
  @Roles(PerfilUsuario.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Lista todos os usuários' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAll(page, limit);
  }

  @Get(':id')
  @Roles(PerfilUsuario.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Busca usuário por ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/perfil')
  @Roles(PerfilUsuario.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Atualiza perfil do usuário' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto);
  }

  @Patch(':id/toggle-active')
  @Roles(PerfilUsuario.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Ativa/desativa usuário' })
  toggleActive(@Param('id') id: string) {
    return this.usersService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Remove usuário' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // --- SUB USERS ---

  @Post('sub-users')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.ESTABELECIMENTO)
  @ApiOperation({ summary: '[GESTOR/ESTAB] Cria um sub-usuário' })
  createSubUser(@CurrentUser('sub') userId: string, @Body() dto: CreateSubUserDto) {
    return this.usersService.createSubUser(userId, dto);
  }

  @Get('sub-users/list')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.ESTABELECIMENTO)
  @ApiOperation({ summary: '[GESTOR/ESTAB] Lista sub-usuários vinculados ao usuário logado' })
  findSubUsers(@CurrentUser('sub') userId: string) {
    return this.usersService.findSubUsers(userId);
  }

  @Patch('sub-users/:id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.ESTABELECIMENTO)
  @ApiOperation({ summary: '[GESTOR/ESTAB] Atualiza sub-usuário' })
  updateSubUser(@CurrentUser('sub') userId: string, @Param('id') id: string, @Body() dto: UpdateSubUserDto) {
    return this.usersService.updateSubUser(userId, id, dto);
  }

  @Delete('sub-users/:id')
  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.ESTABELECIMENTO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[GESTOR/ESTAB] Remove sub-usuário' })
  deleteSubUser(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.usersService.deleteSubUser(userId, id);
  }
}
