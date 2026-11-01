import { Module } from '@nestjs/common';

import { SyncClerkUserUseCase } from './application/sync-clerk-user.use-case.js';
import { USER_REPOSITORY } from './application/user.repository.js';
import { ClerkWebhookController } from './http/clerk-webhook.controller.js';
import { PrismaUserRepository } from './infra/prisma-user.repository.js';

@Module({
  controllers: [ClerkWebhookController],
  providers: [SyncClerkUserUseCase, { provide: USER_REPOSITORY, useClass: PrismaUserRepository }],
})
export class IdentityModule {}
