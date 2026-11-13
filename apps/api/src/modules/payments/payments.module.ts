import { type DynamicModule, Module } from '@nestjs/common';

import { ENV } from '../../shared/config/config.module.js';
import type { Env } from '../../shared/config/env.js';
import { ASAAS_EVENT_REPOSITORY } from './application/asaas-event.repository.js';
import { PAYMENT_GATEWAY, type PaymentGateway } from './application/payment-gateway.port.js';
import { RecordAsaasEventUseCase } from './application/record-asaas-event.use-case.js';
import { AsaasWebhookController } from './http/asaas-webhook.controller.js';
import { AsaasHttpClient } from './infra/asaas/asaas-http.client.js';
import { AsaasGateway } from './infra/asaas/asaas.gateway.js';
import { PrismaAsaasEventRepository } from './infra/prisma-asaas-event.repository.js';

export interface PaymentsModuleOptions {
  /** Substitui o Asaas (usado pelos testes). */
  paymentGateway?: PaymentGateway;
}

// Pagamentos (ADR-0011, ADR-0012): o adaptador do Asaas atrás da porta PaymentGateway
// e o endereço que recebe os avisos do Asaas. Checkout e repasse usam a porta na Fase 2 e 3.
@Module({})
export class PaymentsModule {
  static forRoot({ paymentGateway }: PaymentsModuleOptions = {}): DynamicModule {
    return {
      module: PaymentsModule,
      controllers: [AsaasWebhookController],
      providers: [
        paymentGateway
          ? { provide: PAYMENT_GATEWAY, useValue: paymentGateway }
          : {
              provide: PAYMENT_GATEWAY,
              inject: [ENV],
              useFactory: (env: Env) =>
                new AsaasGateway(new AsaasHttpClient({ apiKey: env.ASAAS_API_KEY, baseUrl: env.ASAAS_API_URL })),
            },
        { provide: ASAAS_EVENT_REPOSITORY, useClass: PrismaAsaasEventRepository },
        RecordAsaasEventUseCase,
      ],
      exports: [PAYMENT_GATEWAY],
    };
  }
}
