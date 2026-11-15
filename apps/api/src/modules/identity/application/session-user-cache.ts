import { Injectable } from '@nestjs/common';

import type { User } from '../domain/user.js';

export type SessionUser = Omit<User, 'deletedAt'>;

const TTL_MS = 60_000;

// Cache curto de quem está logado (spec 01): evita ir ao banco a cada requisição.
// Mora fora do guard para que uma mudança de papel (ex.: loja aprovada) possa apagar
// a entrada da pessoa e valer já na próxima chamada, sem esperar os 60 s.
// O cache é do processo: com mais de uma instância da API, as outras ainda podem levar
// até 60 s. Instância única é o desenho atual (ARCHITECTURE, ADR-0009); se escalar, vai para o Redis.
@Injectable()
export class SessionUserCache {
  private readonly entries = new Map<string, { user: SessionUser; expiresAt: number }>();

  get(clerkId: string): SessionUser | undefined {
    const entry = this.entries.get(clerkId);
    if (!entry) return undefined;
    if (entry.expiresAt > Date.now()) return entry.user;
    this.entries.delete(clerkId);
    return undefined;
  }

  set(user: SessionUser): void {
    this.entries.set(user.clerkId, { user, expiresAt: Date.now() + TTL_MS });
  }

  /** Esquece a pessoa (pelo id da Vitrine): a próxima requisição dela relê os papéis do banco. */
  forget(userId: string): void {
    for (const [clerkId, entry] of this.entries) {
      if (entry.user.id === userId) this.entries.delete(clerkId);
    }
  }
}
