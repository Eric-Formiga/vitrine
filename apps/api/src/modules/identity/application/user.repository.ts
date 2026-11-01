import type { ClerkProfile } from '../domain/user.js';

// Porta: o caso de uso depende disto, não do Prisma.
export interface UserRepository {
  findByClerkId(clerkId: string): Promise<{ deletedAt: Date | null } | null>;
  /** Cria como compradora ou atualiza só os dados de perfil; nunca mexe nos papéis. */
  upsertProfile(profile: ClerkProfile): Promise<void>;
  /** Anonimiza e marca como excluída. Não faz nada se a pessoa não existir. */
  anonymize(clerkId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
