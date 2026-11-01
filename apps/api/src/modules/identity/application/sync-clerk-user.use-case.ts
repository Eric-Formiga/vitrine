import { Inject, Injectable } from '@nestjs/common';

import type { ClerkProfile } from '../domain/user.js';
import { USER_REPOSITORY, type UserRepository } from './user.repository.js';

export type ClerkUserEvent =
  | { type: 'user.created' | 'user.updated'; profile: ClerkProfile }
  | { type: 'user.deleted'; clerkId: string };

// Espelha no banco o que aconteceu com a conta no Clerk (AC-001, AC-003 a AC-005).
// Idempotente e tolerante a ordem: o Clerk pode reenviar avisos ou entregá-los fora de ordem.
@Injectable()
export class SyncClerkUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(event: ClerkUserEvent): Promise<void> {
    if (event.type === 'user.deleted') {
      await this.users.anonymize(event.clerkId);
      return;
    }

    const existing = await this.users.findByClerkId(event.profile.clerkId);
    if (existing?.deletedAt) return; // conta anonimizada não volta a ter dados

    await this.users.upsertProfile(event.profile);
  }
}
