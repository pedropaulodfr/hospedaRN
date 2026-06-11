import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);

    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        telefone: dto.telefone,
        senhaHash,
        perfil: dto.perfil || 'HOSPEDE',
      },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        perfil: true,
        ativo: true,
        criadoEm: true,
      },
    });

    const tokens = await this.generateTokens(usuario.id, usuario.email, usuario.perfil);

    return { usuario, ...tokens };
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.generateTokens(usuario.id, usuario.email, usuario.perfil);
    await this.updateRefreshToken(usuario.id, tokens.refreshToken);

    const { senhaHash, tokenAtualizacaoHash, ...userPublic } = usuario;
    return { usuario: userPublic, ...tokens };
  }

  async logout(userId: string) {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { tokenAtualizacaoHash: null },
    });
    return { message: 'Logout realizado com sucesso' };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });

    if (!usuario || !usuario.tokenAtualizacaoHash) {
      throw new UnauthorizedException('Acesso negado');
    }

    const refreshTokenValid = await bcrypt.compare(
      refreshToken,
      usuario.tokenAtualizacaoHash,
    );

    if (!refreshTokenValid) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const tokens = await this.generateTokens(usuario.id, usuario.email, usuario.perfil);
    await this.updateRefreshToken(usuario.id, tokens.refreshToken);
    return tokens;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    // Sempre retorna sucesso para não expor emails cadastrados
    if (!usuario) {
      return {
        message: 'Se o e-mail estiver cadastrado, você receberá as instruções',
      };
    }

    const token = randomUUID();
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        tokenRecuperacaoSenha: token,
        expiracaoRecuperacaoSenha: expires,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/nova-senha?token=${token}`;

    await this.notificationsService.sendForgotPassword({
      email: usuario.email,
      nome: usuario.nome,
      token,
      resetUrl,
    });

    return {
      message: 'Se o e-mail estiver cadastrado, você receberá as instruções',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        tokenRecuperacaoSenha: dto.token,
        expiracaoRecuperacaoSenha: { gt: new Date() },
      },
    });

    if (!usuario) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const senhaHash = await bcrypt.hash(dto.novaSenha, 12);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash,
        tokenRecuperacaoSenha: null,
        expiracaoRecuperacaoSenha: null,
        tokenAtualizacaoHash: null,
      },
    });

    return { message: 'Senha redefinida com sucesso' };
  }

  private async generateTokens(userId: string, email: string, perfil: string) {
    const payload = { sub: userId, email, perfil };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRATION', '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d') as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { tokenAtualizacaoHash: hash },
    });
  }
}
