import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { Role } from '../../../shared/auth/roles.decorator.js';
import { SessionUserCache } from './session-user-cache.js';

/** Cliente do Prisma ou a transação em curso: o papel entra junto com a mudança que o justifica. */
export type RolesWriter = Pick<Prisma.TransactionClient, 'user'>;

// Papéis dados por outros módulos (ex.: `seller` ao aprovar a loja). Exportado pelo identity.
@Injectable()
export class UserRolesService {
  constructor(private readonly sessions: SessionUserCache) {}

  /** Adiciona o papel dentro da transação de quem chama. Idempotente, mesmo em corrida. */
  async grant(db: RolesWriter, userId: string, role: Role): Promise<void> {
    await db.user.updateMany({
      where: { id: userId, NOT: { roles: { has: role } } },
      data: { roles: { push: role } },
    });
  }

  /** Chame DEPOIS do commit: a próxima requisição da pessoa já vê os papéis novos. */
  refresh(userId: string): void {
    this.sessions.forget(userId);
  }
}
