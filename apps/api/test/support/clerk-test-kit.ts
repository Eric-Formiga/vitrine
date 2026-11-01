import { randomUUID } from 'node:crypto';

import { Webhook } from 'svix';

// Segredo só de teste, montado em tempo de execução (não é um segredo de verdade).
export const TEST_WEBHOOK_SECRET = 'whsec_' + Buffer.from('segredo-de-teste-da-vitrine!').toString('base64');

export interface ClerkUserData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string | null;
  email_addresses: { id: string; email_address: string }[];
  primary_phone_number_id: string | null;
  phone_numbers: { id: string; phone_number: string }[];
}

// Usuário no formato do payload do Clerk (só os campos que a Vitrine lê).
export function clerkUser(overrides: Partial<{ id: string; firstName: string; lastName: string; email: string; phone: string }> = {}): ClerkUserData {
  const email = overrides.email ?? 'ana@exemplo.com';
  return {
    id: overrides.id ?? 'user_ana',
    first_name: overrides.firstName ?? 'Ana',
    last_name: overrides.lastName ?? 'Souza',
    primary_email_address_id: 'idn_email',
    email_addresses: [{ id: 'idn_email', email_address: email }],
    primary_phone_number_id: overrides.phone ? 'idn_phone' : null,
    phone_numbers: overrides.phone ? [{ id: 'idn_phone', phone_number: overrides.phone }] : [],
  };
}

export interface SignedEvent {
  body: string;
  headers: Record<'svix-id' | 'svix-timestamp' | 'svix-signature', string>;
}

// Monta um aviso assinado como o Clerk (via Svix) faria.
export function signedEvent(type: string, data: object, msgId = `msg_${randomUUID()}`): SignedEvent {
  const body = JSON.stringify({ type, object: 'event', data });
  const now = new Date();
  const signature = new Webhook(TEST_WEBHOOK_SECRET).sign(msgId, now, body);
  return {
    body,
    headers: {
      'svix-id': msgId,
      'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
      'svix-signature': signature,
    },
  };
}
