import { Inject, Injectable, Logger } from '@nestjs/common';

import { ASAAS_EVENT_REPOSITORY, type AsaasEventRepository } from './asaas-event.repository.js';
import { PAYMENT_GATEWAY, type Payment, type PaymentGateway, type PixTransfer } from './payment-gateway.port.js';

/** O que a Vitrine aproveita de um aviso: o id do evento, o tipo e o id do objeto. Nada mais. */
export interface AsaasEventNotice {
  id: string;
  type: string;
  paymentId?: string;
  transferId?: string;
}

export type AsaasEventOutcome =
  | { outcome: 'processed'; current: Payment | PixTransfer | null }
  | { outcome: 'duplicate' };

// Processa um aviso do Asaas uma vez só (spec 05, ADR-0011). O conteúdo do aviso não é
// confiável para decidir nada: ele só diz "algo mudou no objeto X". O estado é sempre
// buscado na API do Asaas. Aqui (spike) só registra e reconsulta; reagir ao pagamento
// (marcar pedido pago etc.) é da Fase 2.
@Injectable()
export class RecordAsaasEventUseCase {
  private readonly logger = new Logger('AvisosAsaas');

  constructor(
    @Inject(ASAAS_EVENT_REPOSITORY) private readonly events: AsaasEventRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async execute(notice: AsaasEventNotice): Promise<AsaasEventOutcome> {
    const { alreadyProcessed } = await this.events.register({ id: notice.id, type: notice.type });
    if (alreadyProcessed) {
      this.logger.log({ eventId: notice.id, type: notice.type, msg: 'aviso do Asaas repetido: ignorado' });
      return { outcome: 'duplicate' };
    }

    const current = await this.reconsult(notice);
    await this.events.markProcessed(notice.id);
    this.logger.log({
      eventId: notice.id,
      type: notice.type,
      resourceId: current?.id ?? null,
      // Estado lido da API do Asaas, não do aviso.
      status: current?.status ?? null,
      msg: 'aviso do Asaas processado',
    });
    return { outcome: 'processed', current };
  }

  private async reconsult(notice: AsaasEventNotice): Promise<Payment | PixTransfer | null> {
    if (notice.paymentId) return this.gateway.getPayment(notice.paymentId);
    if (notice.transferId) return this.gateway.getTransfer(notice.transferId);
    // Outros avisos (checkout, situação da conta…) só ficam registrados por enquanto.
    return null;
  }
}
