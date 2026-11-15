import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { RolesGuard } from '../../shared/auth/roles.guard.js';
import { CLERK_GATEWAY, type ClerkGateway } from './application/clerk-gateway.port.js';
import { GrantAdminUseCase } from './application/grant-admin.use-case.js';
import { ProvisionUserUseCase } from './application/provision-user.use-case.js';
import { SessionUserCache } from './application/session-user-cache.js';
import { SyncClerkUserUseCase } from './application/sync-clerk-user.use-case.js';
import { USER_REPOSITORY } from './application/user.repository.js';
import { UserRolesService } from './application/user-roles.service.js';
import { ClerkAuthGuard } from './http/clerk-auth.guard.js';
import { ClerkWebhookController } from './http/clerk-webhook.controller.js';
import { MeController } from './http/me.controller.js';
import { ClerkBackendGateway } from './infra/clerk-backend.gateway.js';
import { PrismaUserRepository } from './infra/prisma-user.repository.js';

export interface IdentityModuleOptions {
  /** Substitui a API do Clerk (usado pelos testes). */
  clerkGateway?: ClerkGateway;
}

@Module({})
export class IdentityModule {
  static forRoot({ clerkGateway }: IdentityModuleOptions = {}): DynamicModule {
    return {
      module: IdentityModule,
      // Global: outros módulos dão papéis (UserRolesService) sem reimportar o forRoot.
      global: true,
      controllers: [ClerkWebhookController, MeController],
      providers: [
        SyncClerkUserUseCase,
        ProvisionUserUseCase,
        SessionUserCache,
        UserRolesService,
        { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
        clerkGateway
          ? { provide: CLERK_GATEWAY, useValue: clerkGateway }
          : { provide: CLERK_GATEWAY, useClass: ClerkBackendGateway },
        GrantAdminUseCase,
        // A ordem importa: primeiro quem é (login), depois o que pode (papéis do banco).
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
      exports: [GrantAdminUseCase, UserRolesService],
    };
  }
}
