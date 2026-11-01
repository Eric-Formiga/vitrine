import { Inject, Injectable } from '@nestjs/common';

import type { User } from '../domain/user.js';
import { CLERK_GATEWAY, type ClerkGateway } from './clerk-gateway.port.js';
import { USER_REPOSITORY, type UserRepository } from './user.repository.js';

// Quem está logado na Vitrine. Se o aviso do Clerk ainda não chegou, busca a conta no
// Clerk e cadastra na hora (AC-006). Devolve null para conta excluída ou desconhecida.
@Injectable()
export class ProvisionUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLERK_GATEWAY) private readonly clerk: ClerkGateway,
  ) {}

  async execute(clerkId: string): Promise<User | null> {
    const existing = await this.users.findByClerkId(clerkId);
    if (existing) return existing.deletedAt ? null : existing;

    const profile = await this.clerk.fetchProfile(clerkId);
    if (!profile) return null;

    // Upsert: se o aviso do Clerk chegar ao mesmo tempo, não duplica (AC-003).
    await this.users.upsertProfile(profile);
    return this.users.findByClerkId(clerkId);
  }
}
