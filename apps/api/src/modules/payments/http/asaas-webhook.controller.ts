import { createHash, timingSafeEqual } from 'node:crypto';

import { BadRequestException, Body, Controller, Headers, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';

import { Public } from '../../../shared/auth/public.decorator.js';
import { ENV } from '../../../shared/config/config.module.js';
import type { Env } from '../../../shared/config/env.js';
import { RecordAsaasEventUseCase } from '../application/record-asaas-event.use-case.js';

// Só o que a Vitrine usa do aviso: id do evento, tipo e id do objeto. O resto (status,
// valores) não é lido de propósito: o estado vem da API do Asaas (AC-041).
const asaasNotice = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payment: z.object({ id: z.string().min(1) }).optional(),
  transfer: z.object({ id: z.string().min(1) }).optional(),
});

const sha256 = (value: string) => createHash('sha256').update(value).digest();

// POST /v1/webhooks/asaas — o Asaas avisa mudanças em cobranças, checkouts e transferências.
// Público para o login; quem protege é o token no cabeçalho asaas-access-token (AC-040).
@Public()
@Controller('webhooks/asaas')
export class AsaasWebhookController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly recordAsaasEvent: RecordAsaasEventUseCase,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    this.assertToken(token);

    const parsed = asaasNotice.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Aviso do Asaas fora do formato esperado.');

    const notice = parsed.data;
    await this.recordAsaasEvent.execute({
      id: notice.id,
      type: notice.event,
      paymentId: notice.payment?.id,
      transferId: notice.transfer?.id,
    });
    return { received: true };
  }

  /**
   * Sem ASAAS_WEBHOOK_TOKEN configurado, recusa tudo. A comparação é em tempo constante,
   * sobre os hashes (mesmo tamanho), para o tempo de resposta não revelar o token.
   */
  private assertToken(token: string | undefined): void {
    const expected = this.env.ASAAS_WEBHOOK_TOKEN;
    const valid = Boolean(expected && token && timingSafeEqual(sha256(token), sha256(expected)));
    if (!valid) throw new UnauthorizedException('Aviso sem o token do Asaas, ou com token inválido.');
  }
}
