import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

import { IS_PUBLIC } from '../../../shared/auth/public.decorator.js';
import { ENV } from '../../../shared/config/config.module.js';
import type { Env } from '../../../shared/config/env.js';
import { ProvisionUserUseCase } from '../application/provision-user.use-case.js';
import { SessionUserCache } from '../application/session-user-cache.js';
import type { CurrentUserData } from './current-user.decorator.js';

const UNAUTHORIZED = 'É preciso entrar para acessar este recurso.';

// Guard global: toda rota exige login, a não ser as marcadas com @Public() (AC-007).
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  // Cache curto (60 s) para não ir ao banco a cada requisição (spec 01). Quem muda papéis
  // usa o UserRolesService, que apaga a entrada da pessoa (AC-051).
  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
    private readonly provisionUser: ProvisionUserUseCase,
    private readonly cache: SessionUserCache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: CurrentUserData }>();
    const clerkId = await this.verifiedClerkId(req.headers.authorization);
    req.user = await this.loadUser(clerkId);
    return true;
  }

  // Assinatura, validade e origem (azp) conferidas com a chave pública, sem rede.
  private async verifiedClerkId(authorization: string | undefined): Promise<string> {
    const token = authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException(UNAUTHORIZED);
    try {
      const claims = await verifyToken(token, {
        jwtKey: this.env.CLERK_JWT_KEY,
        authorizedParties: this.env.CLERK_AUTHORIZED_PARTIES,
      });
      return claims.sub;
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED);
    }
  }

  // O token só diz QUEM é; o que a pessoa pode fazer vem sempre do banco (AC-008).
  private async loadUser(clerkId: string): Promise<CurrentUserData> {
    const cached = this.cache.get(clerkId);
    if (cached) return cached;

    const user = await this.provisionUser.execute(clerkId);
    if (!user) throw new UnauthorizedException(UNAUTHORIZED);

    const current: CurrentUserData = { id: user.id, clerkId: user.clerkId, email: user.email, name: user.name, roles: user.roles };
    this.cache.set(current);
    return current;
  }
}
