import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto, UpdateUserRoleDto, ChangePasswordDto } from './dto/usuario.dto';
import { CreateSubUserDto, UpdateSubUserDto } from './dto/sub-usuario.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';

const USER_SELECT = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true,
  subPerfil: true,
  permissoes: true,
  estabelecimentoVinculadoId: true,
};

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.usuario.findMany({ skip, take: limit, select: USER_SELECT, orderBy: { criadoEm: 'desc' } }),
      this.prisma.usuario.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, select: USER_SELECT });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  async findMe(userId: string) {
    return this.findOne(userId);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.usuario.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const senhaValida = await bcrypt.compare(dto.senhaAtual, usuario.senhaHash);
    if (!senhaValida) throw new BadRequestException('Senha atual incorreta');

    const hash = await bcrypt.hash(dto.novaSenha, 12);
    await this.prisma.usuario.update({ where: { id: userId }, data: { senhaHash: hash } });
    return { message: 'Senha alterada com sucesso' };
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    await this.findOne(id);
    return this.prisma.usuario.update({ where: { id }, data: { perfil: dto.perfil }, select: USER_SELECT });
  }

  async toggleActive(id: string) {
    const usuario = await this.findOne(id);
    return this.prisma.usuario.update({
      where: { id },
      data: { ativo: !usuario.ativo },
      select: USER_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.usuario.delete({ where: { id } });
    return { message: 'Usuário removido com sucesso' };
  }

  // --- SUB USERS ---

  async createSubUser(creatorId: string, dto: CreateSubUserDto) {
    const creator = await this.prisma.usuario.findUnique({ where: { id: creatorId } });
    if (!creator) throw new NotFoundException('Usuário criador não encontrado');

    if (creator.perfil !== 'ADMIN' && creator.perfil !== 'ESTABELECIMENTO') {
      throw new ForbiddenException('Apenas gestores e estabelecimentos podem criar sub-usuários');
    }

    const existingUser = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new BadRequestException('E-mail já está em uso');

    // Create a random password since the user will redefine it
    const randomPassword = randomUUID();
    const senhaHash = await bcrypt.hash(randomPassword, 10);

    const estabelecimentoVinculadoId =
      creator.perfil === 'ESTABELECIMENTO' ? creator.id : dto.estabelecimentoVinculadoId; // Adjust logic if needed based on structure

    const newSubUser = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        perfil: creator.perfil, // Inherits the main profile type (ADMIN or ESTABELECIMENTO)
        subPerfil: dto.subPerfil,
        permissoes: dto.permissoes || [],
        criadoPorId: creatorId,
        estabelecimentoVinculadoId: estabelecimentoVinculadoId,
      },
      select: USER_SELECT,
    });

    // Automatically trigger forgot password flow
    await this.authService.forgotPassword({ email: newSubUser.email });

    return newSubUser;
  }

  async findSubUsers(creatorId: string) {
    return this.prisma.usuario.findMany({
      where: { criadoPorId: creatorId },
      select: USER_SELECT,
      orderBy: { criadoEm: 'desc' },
    });
  }

  async updateSubUser(creatorId: string, id: string, dto: UpdateSubUserDto) {
    const subUser = await this.prisma.usuario.findFirst({
      where: { id, criadoPorId: creatorId },
    });

    if (!subUser) throw new NotFoundException('Sub-usuário não encontrado');

    return this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome,
        subPerfil: dto.subPerfil,
        permissoes: dto.permissoes,
      },
      select: USER_SELECT,
    });
  }

  async deleteSubUser(creatorId: string, id: string) {
    const subUser = await this.prisma.usuario.findFirst({
      where: { id, criadoPorId: creatorId },
    });

    if (!subUser) throw new NotFoundException('Sub-usuário não encontrado');

    await this.prisma.usuario.delete({ where: { id } });
    return { message: 'Sub-usuário removido com sucesso' };
  }
}
