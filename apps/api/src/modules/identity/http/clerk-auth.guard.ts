import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

import { IS_PUBLIC } from '../../../shared/auth/public.decorator.js';
import { ENV } from '../../../shared/config/config.module.js';
import type { Env } from '../../../shared/config/env.js';
import { ProvisionUserUseCase } from '../application/provision-user.use-case.js';
import type { CurrentUserData } from './current-user.decorator.js';

const CACHE_TTL_MS = 60_000;
const UNAUTHORIZED = 'É preciso entrar para acessar este recurso.';

// Guard global: toda rota exige login, a não ser as marcadas com @Public() (AC-007).
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  // Cache curto para não ir ao banco a cada requisição (spec 01). Os papéis podem levar
  // até 60 s para refletir uma mudança; a invalidação explícita chega na Fase 1.
  private readonly cache = new Map<string, { user: CurrentUserData; expiresAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    @Inject(ENV) private readonly env: Env,
    private readonly provisionUser: ProvisionUserUseCase,
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
    if (cached && cached.expiresAt > Date.now()) return cached.user;

    const user = await this.provisionUser.execute(clerkId);
    if (!user) throw new UnauthorizedException(UNAUTHORIZED);

    const current: CurrentUserData = { id: user.id, clerkId: user.clerkId, email: user.email, name: user.name, roles: user.roles };
    this.cache.set(clerkId, { user: current, expiresAt: Date.now() + CACHE_TTL_MS });
    return current;
  }
}
