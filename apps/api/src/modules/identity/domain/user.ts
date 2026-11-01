// Regras puras da identidade: sem Nest, sem Prisma (ADR-0002).

export const DEFAULT_ROLES = ['customer'] as const;

/** Dados que vêm do Clerk e que a Vitrine espelha. */
export interface ClerkProfile {
  clerkId: string;
  email: string;
  name: string | null;
  phone: string | null;
}

/**
 * Identidade de quem excluiu a conta. A linha nunca é apagada, porque pedidos e
 * repasses apontam para ela; os dados pessoais é que somem (spec 01, LGPD).
 * O e-mail continua único e usa o domínio reservado .invalid (RFC 2606).
 */
export function anonymizedIdentity(clerkId: string): Pick<ClerkProfile, 'email' | 'name' | 'phone'> {
  return {
    name: 'Conta excluída',
    email: `excluido+${clerkId.toLowerCase()}@anonimo.invalid`,
    phone: null,
  };
}
