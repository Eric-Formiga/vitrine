import { BadRequestException, Controller, Headers, HttpCode, Inject, Post, type RawBodyRequest, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { z } from 'zod';

import { ENV } from '../../../shared/config/config.module.js';
import type { Env } from '../../../shared/config/env.js';
import { type ClerkUserEvent, SyncClerkUserUseCase } from '../application/sync-clerk-user.use-case.js';

// Só os campos do payload do Clerk que a Vitrine usa.
const clerkUserData = z.object({
  id: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  primary_email_address_id: z.string().nullish(),
  email_addresses: z.array(z.object({ id: z.string(), email_address: z.string() })),
  primary_phone_number_id: z.string().nullish(),
  phone_numbers: z.array(z.object({ id: z.string(), phone_number: z.string() })).default([]),
});

const clerkEvent = z.discriminatedUnion('type', [
  z.object({ type: z.enum(['user.created', 'user.updated']), data: clerkUserData }),
  z.object({ type: z.literal('user.deleted'), data: z.object({ id: z.string() }) }),
]);

// POST /v1/webhooks/clerk — o Clerk avisa quando uma conta é criada, alterada ou excluída.
@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly webhook: Webhook;

  constructor(
    @Inject(ENV) env: Env,
    private readonly syncClerkUser: SyncClerkUserUseCase,
  ) {
    this.webhook = new Webhook(env.CLERK_WEBHOOK_SECRET);
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | undefined>,
  ): Promise<{ received: true }> {
    const payload = req.rawBody?.toString('utf8') ?? '';

    // A assinatura é conferida sobre o corpo cru: qualquer byte alterado invalida (AC-002).
    try {
      this.webhook.verify(payload, {
        'svix-id': headers['svix-id'] ?? '',
        'svix-timestamp': headers['svix-timestamp'] ?? '',
        'svix-signature': headers['svix-signature'] ?? '',
      });
    } catch {
      throw new BadRequestException('Assinatura do aviso inválida ou ausente.');
    }

    const event = toUserEvent(JSON.parse(payload));
    if (event) await this.syncClerkUser.execute(event);
    return { received: true };
  }
}

// Eventos que a Vitrine não usa (sessões, organizações…) são aceitos e ignorados.
function toUserEvent(body: unknown): ClerkUserEvent | null {
  const parsed = clerkEvent.safeParse(body);
  if (!parsed.success) return null;

  const event = parsed.data;
  if (event.type === 'user.deleted') return { type: event.type, clerkId: event.data.id };

  const data = event.data;
  const email =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id) ?? data.email_addresses[0];
  if (!email) throw new BadRequestException('Conta do Clerk sem e-mail (ASM-004).');

  const phone = data.phone_numbers.find((p) => p.id === data.primary_phone_number_id);
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;

  return {
    type: event.type,
    profile: { clerkId: data.id, email: email.email_address, name, phone: phone?.phone_number ?? null },
  };
}
