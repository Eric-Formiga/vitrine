import { Module } from '@nestjs/common';

import { ENV } from '../../shared/config/config.module.js';
import type { Env } from '../../shared/config/env.js';
import { PAYMENT_GATEWAY } from './application/payment-gateway.port.js';
import { AsaasHttpClient } from './infra/asaas/asaas-http.client.js';
import { AsaasGateway } from './infra/asaas/asaas.gateway.js';

// Pagamentos (ADR-0011). Por enquanto, só o adaptador do Asaas atrás da porta
// PaymentGateway; checkout, repasse e webhook chegam nas próximas tarefas.
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [ENV],
      useFactory: (env: Env) =>
        new AsaasGateway(new AsaasHttpClient({ apiKey: env.ASAAS_API_KEY, baseUrl: env.ASAAS_API_URL })),
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
