import type { ClerkProfile } from '../domain/user.js';

// Porta para a API do Clerk. Nos testes, um fake; em produção, o adapter com @clerk/backend.
export interface ClerkGateway {
  /** Perfil da conta no Clerk, ou null se ela não existir lá. */
  fetchProfile(clerkId: string): Promise<ClerkProfile | null>;
}

export const CLERK_GATEWAY = Symbol('CLERK_GATEWAY');
