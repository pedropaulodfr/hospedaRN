import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { usuario } = context.switchToHttp().getRequest();

    if (!usuario) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Se o usuário não tem o campo permissoes ou não for array, tratar como vazio
    const userPermissions = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];

    // O usuário principal (que não tem subPerfil ou que é ADMIN por padrão sem ser sub-usuário) 
    // teoricamente teria acesso total. Podemos checar se ele tem criadoPorId.
    // Mas para simplificar, se exigiu permissão, vamos checar.
    // Se for um usuário "pai" (sem criadoPorId), podemos pular a verificação de permissões?
    // Ou podemos garantir que usuários pais têm uma permissão especial ou apenas pular.
    if (!usuario.criadoPorId) {
      // Usuário principal (Gestor ou Estabelecimento root)
      return true;
    }

    const hasPermission = requiredPermissions.some((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      throw new ForbiddenException(
        `Acesso restrito. Permissão necessária: ${requiredPermissions.join(' ou ')}`,
      );
    }

    return true;
  }
}
