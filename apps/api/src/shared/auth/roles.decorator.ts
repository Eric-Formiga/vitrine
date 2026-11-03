import { applyDecorators, Controller, SetMetadata } from '@nestjs/common';

export type Role = 'customer' | 'seller' | 'admin';

export const REQUIRED_ROLES = 'vitrine:requiredRoles';

// Exige que quem chama tenha TODOS os papéis listados (papéis vêm do banco, AC-008).
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_ROLES, roles);

// Controller da área de admin: sempre em /admin/... e sempre exigindo o papel admin.
// Usar este decorator (e não @Controller) impede de esquecer a proteção numa rota nova.
export const AdminController = (path: string): ClassDecorator =>
  applyDecorators(Controller(`admin/${path}`), Roles('admin'));
