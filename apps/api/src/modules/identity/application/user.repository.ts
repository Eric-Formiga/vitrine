import type { ClerkProfile, User } from '../domain/user.js';

// Porta: os casos de uso dependem disto, não do Prisma.
export interface UserRepository {
  findByClerkId(clerkId: string): Promise<User | null>;
  /** Cria como compradora ou atualiza só os dados de perfil; nunca mexe nos papéis. */
  upsertProfile(profile: ClerkProfile): Promise<void>;
  /** Anonimiza e marca como excluída. Não faz nada se a pessoa não existir. */
  anonymize(clerkId: string): Promise<void>;
  /** Conta ativa (não excluída) com este e-mail, sem diferenciar maiúsculas. */
  findActiveByEmail(email: string): Promise<User | null>;
  /** Acrescenta o papel se a pessoa ainda não o tiver; nunca remove os outros. */
  addRole(userId: string, role: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
