import { type CanActivate, type ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { REQUIRED_ROLES, type Role } from './roles.decorator.js';

// Roda depois do guard de login, que já carregou a pessoa (e os papéis) do banco.
// Sem o papel, a resposta é igual à de uma rota que não existe: quem não é admin
// nem descobre que a área existe (spec 10, AC-021).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: { roles: string[] } }>();
    const roles = req.user?.roles ?? [];
    if (required.every((role) => roles.includes(role))) return true;

    // Mesma mensagem que o Nest usa para rota inexistente.
    throw new NotFoundException(`Cannot ${req.method} ${req.originalUrl}`);
  }
}
