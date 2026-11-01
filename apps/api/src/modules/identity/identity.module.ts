import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CLERK_GATEWAY, type ClerkGateway } from './application/clerk-gateway.port.js';
import { ProvisionUserUseCase } from './application/provision-user.use-case.js';
import { SyncClerkUserUseCase } from './application/sync-clerk-user.use-case.js';
import { USER_REPOSITORY } from './application/user.repository.js';
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
      controllers: [ClerkWebhookController, MeController],
      providers: [
        SyncClerkUserUseCase,
        ProvisionUserUseCase,
        { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
        clerkGateway
          ? { provide: CLERK_GATEWAY, useValue: clerkGateway }
          : { provide: CLERK_GATEWAY, useClass: ClerkBackendGateway },
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
      ],
    };
  }
}
