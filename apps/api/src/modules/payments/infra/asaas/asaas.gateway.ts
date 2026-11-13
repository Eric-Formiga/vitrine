import type {
  CreateCheckoutInput,
  CreatePixPaymentInput,
  HostedCheckout,
  Payment,
  PaymentCustomer,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PixTransfer,
  PixTransferStatus,
  Refund,
  RefundInput,
  RefundStatus,
  TransferPixInput,
} from '../../application/payment-gateway.port.js';
import {
  PaymentDeclinedError,
  PaymentProviderError,
  PixKeyNotFoundError,
  PixTransferDuplicateError,
  RefundNotAllowedError,
} from '../../domain/payment-errors.js';
import type { PixKey, PixKeyOwner } from '../../domain/pix-key.js';
import type { AsaasHttpClient } from './asaas-http.client.js';

/** Resposta de GET /pix/addressKeys/external (só os campos que a Vitrine usa). */
interface AsaasPixKeyLookup {
  owner: { name: string; cpfCnpj: string };
}

interface AsaasList<T> {
  /** O Asaas devolve `null` (e não []) em algumas listas vazias. */
  data: T[] | null;
  hasMore?: boolean;
}

interface AsaasRefund {
  value: number;
  status: string;
  dateCreated: string;
}

interface AsaasTransfer {
  id: string;
  status: string;
  value: number;
  transferFee: number | null;
  externalReference: string | null;
  scheduleDate: string | null;
  effectiveDate: string | null;
  failReason: string | null;
}

interface AsaasCustomer {
  id: string;
}

/** Cobrança do Asaas (GET /payments/{id}), só os campos que a Vitrine usa. Valores em reais. */
interface AsaasPayment {
  id: string;
  billingType: string;
  status: string;
  value: number;
  netValue: number;
  externalReference: string | null;
  dueDate: string;
  confirmedDate: string | null;
  paymentDate: string | null;
  estimatedCreditDate: string | null;
  refunds?: AsaasRefund[] | null;
}

interface AsaasCheckout {
  id: string;
  link: string;
  billingTypes: string[];
  externalReference: string | null;
}

/** Cartão e titular para a cobrança direta (só no spike: em produção o cartão vai pelo Checkout). */
export interface DirectCardPaymentInput {
  customerId: string;
  amountCents: number;
  dueDate: string;
  description: string;
  reference: string;
  card: { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
  holder: { name: string; email: string; document: string; postalCode: string; addressNumber: string; phone: string };
  /** IP do comprador: o Asaas exige na cobrança direta com cartão. */
  remoteIp: string;
}

// Situações do Asaas → situações da Vitrine. Desconhecida vira UNKNOWN, nunca um palpite.
const STATUS: Record<string, PaymentStatus> = {
  PENDING: 'PENDING',
  AWAITING_RISK_ANALYSIS: 'AWAITING_RISK_ANALYSIS',
  CONFIRMED: 'CONFIRMED',
  RECEIVED: 'RECEIVED',
  RECEIVED_IN_CASH: 'RECEIVED',
  OVERDUE: 'OVERDUE',
  DUNNING_REQUESTED: 'OVERDUE',
  DUNNING_RECEIVED: 'RECEIVED',
  REFUND_REQUESTED: 'REFUND_IN_PROGRESS',
  REFUND_IN_PROGRESS: 'REFUND_IN_PROGRESS',
  REFUNDED: 'REFUNDED',
  CHARGEBACK_REQUESTED: 'CHARGEBACK',
  CHARGEBACK_DISPUTE: 'CHARGEBACK',
  AWAITING_CHARGEBACK_REVERSAL: 'CHARGEBACK',
};

const REFUND_STATUS: Record<string, RefundStatus> = {
  PENDING: 'PENDING',
  AWAITING_CRITICAL_ACTION_AUTHORIZATION: 'AWAITING_AUTHORIZATION',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
};

const TRANSFER_STATUS: Record<string, PixTransferStatus> = {
  PENDING: 'PENDING',
  AWAITING_CRITICAL_ACTION_AUTHORIZATION: 'AWAITING_AUTHORIZATION',
  BANK_PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
};

/** Tamanho de página da listagem de transferências (máximo do Asaas). */
const TRANSFERS_PAGE_SIZE = 100;

const toCents = (reais: number) => Math.round(reais * 100);
const toReais = (cents: number) => cents / 100;
const onlyDigits = (value: string) => value.replace(/\D/g, '');
const toMethod = (billingType: string): PaymentMethod =>
  billingType === 'PIX' || billingType === 'CREDIT_CARD' ? billingType : 'OTHER';

function toRefund(refund: AsaasRefund): Refund {
  return {
    amountCents: toCents(refund.value),
    status: REFUND_STATUS[refund.status] ?? 'UNKNOWN',
    requestedAt: refund.dateCreated,
  };
}

function toTransfer(transfer: AsaasTransfer): PixTransfer {
  return {
    id: transfer.id,
    status: TRANSFER_STATUS[transfer.status] ?? 'UNKNOWN',
    amountCents: toCents(transfer.value),
    feeCents: toCents(transfer.transferFee ?? 0),
    reference: transfer.externalReference ?? null,
    scheduledOn: transfer.scheduleDate ?? null,
    doneOn: transfer.effectiveDate ?? null,
    failReason: transfer.failReason ?? null,
  };
}

function toPayment(payment: AsaasPayment): Payment {
  const refunds = (payment.refunds ?? []).map(toRefund);
  return {
    id: payment.id,
    method: toMethod(payment.billingType),
    status: STATUS[payment.status] ?? 'UNKNOWN',
    amountCents: toCents(payment.value),
    netAmountCents: toCents(payment.netValue),
    reference: payment.externalReference ?? null,
    dueDate: payment.dueDate,
    confirmedOn: payment.confirmedDate ?? null,
    receivedOn: payment.paymentDate ?? null,
    expectedCreditOn: payment.estimatedCreditDate ?? null,
    refunds,
    refundedAmountCents: refunds
      .filter((refund) => refund.status !== 'CANCELLED')
      .reduce((sum, refund) => sum + refund.amountCents, 0),
  };
}

// Adaptador do Asaas (ADR-0011, ADR-0012): traduz a porta PaymentGateway para a API v3.
// Valores: a Vitrine usa centavos; o Asaas usa reais com casas decimais.
export class AsaasGateway implements PaymentGateway {
  constructor(private readonly http: AsaasHttpClient) {}

  async lookupPixKey({ type, key }: PixKey): Promise<PixKeyOwner> {
    try {
      const found = await this.http.get<AsaasPixKeyLookup>('/pix/addressKeys/external', { type, key });
      return { name: found.owner.name, maskedDocument: found.owner.cpfCnpj };
    } catch (error) {
      // Chave inexistente: o Asaas responde 404 sem corpo.
      if (error instanceof PaymentProviderError && error.providerStatus === 404) throw new PixKeyNotFoundError();
      throw error;
    }
  }

  async ensureCustomer({ name, document, email }: PaymentCustomer): Promise<string> {
    const cpfCnpj = onlyDigits(document);
    const found = await this.http.get<AsaasList<AsaasCustomer>>('/customers', { cpfCnpj });
    const existing = found.data?.[0];
    if (existing) return existing.id;
    // Os avisos ao comprador são da Vitrine (spec 09): o Asaas não manda e-mail nem SMS.
    const created = await this.http.post<AsaasCustomer>('/customers', { name, cpfCnpj, email, notificationDisabled: true });
    return created.id;
  }

  async createPixPayment(input: CreatePixPaymentInput): Promise<Payment> {
    const created = await this.http.post<AsaasPayment>('/payments', {
      customer: input.customerId,
      billingType: 'PIX',
      value: toReais(input.amountCents),
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.reference,
    });
    return toPayment(created);
  }

  /**
   * Cobrança direta com cartão. Fica FORA da porta de propósito: na Vitrine o cartão só
   * passa pelo Checkout hospedado (ADR-0011, PCI SAQ-A). Existe para o spike provar o
   * comportamento do cartão no Asaas (confirmado × recebido, recusa).
   */
  async createCardPayment(input: DirectCardPaymentInput): Promise<Payment> {
    try {
      const created = await this.http.post<AsaasPayment>('/payments', {
        customer: input.customerId,
        billingType: 'CREDIT_CARD',
        value: toReais(input.amountCents),
        dueDate: input.dueDate,
        description: input.description,
        externalReference: input.reference,
        creditCard: input.card,
        creditCardHolderInfo: {
          name: input.holder.name,
          email: input.holder.email,
          cpfCnpj: onlyDigits(input.holder.document),
          postalCode: input.holder.postalCode,
          addressNumber: input.holder.addressNumber,
          phone: input.holder.phone,
        },
        remoteIp: input.remoteIp,
      });
      return toPayment(created);
    } catch (error) {
      if (isCardDecline(error)) throw new PaymentDeclinedError(error.providerMessages);
      throw error;
    }
  }

  async getPayment(paymentId: string): Promise<Payment> {
    return toPayment(await this.http.get<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`));
  }

  async createCheckout(input: CreateCheckoutInput): Promise<HostedCheckout> {
    const created = await this.http.post<AsaasCheckout>('/checkouts', {
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      minutesToExpire: input.expiresInMinutes,
      externalReference: input.reference,
      callback: { successUrl: input.successUrl, cancelUrl: input.cancelUrl, expiredUrl: input.expiredUrl },
      items: input.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        value: toReais(item.unitAmountCents),
      })),
    });
    return {
      id: created.id,
      url: created.link,
      methods: created.billingTypes.map(toMethod),
      reference: created.externalReference ?? null,
    };
  }

  async getAvailableBalanceCents(): Promise<number> {
    const { balance } = await this.http.get<{ balance: number }>('/finance/balance');
    return toCents(balance);
  }

  async refund({ paymentId, amountCents, description }: RefundInput): Promise<Payment> {
    try {
      const refunded = await this.http.post<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
        value: toReais(amountCents),
        ...(description ? { description } : {}),
      });
      return toPayment(refunded);
    } catch (error) {
      // O Asaas recusa estorno com 400 invalid_action (ex.: valor acima do que sobrou).
      if (error instanceof PaymentProviderError && error.providerStatus === 400) {
        throw new RefundNotAllowedError(error.providerMessages);
      }
      throw error;
    }
  }

  async transferPix({ pixKey, amountCents, reference, description }: TransferPixInput): Promise<PixTransfer> {
    const existing = await this.findTransferByReference(reference);
    if (existing) return toTransfer(existing);

    try {
      const created = await this.http.post<AsaasTransfer>('/transfers', {
        value: toReais(amountCents),
        operationType: 'PIX',
        pixAddressKey: pixKey.key,
        pixAddressKeyType: pixKey.type,
        externalReference: reference,
        ...(description ? { description } : {}),
      });
      return toTransfer(created);
    } catch (error) {
      // Mesmo valor para a mesma chave no mesmo dia, ainda que com outra referência.
      if (error instanceof PaymentProviderError && error.providerCodes.includes('checkout.already.requested')) {
        throw new PixTransferDuplicateError(error.providerMessages);
      }
      throw error;
    }
  }

  async getTransfer(transferId: string): Promise<PixTransfer> {
    return toTransfer(await this.http.get<AsaasTransfer>(`/transfers/${encodeURIComponent(transferId)}`));
  }

  /**
   * O GET /transfers ignora o filtro `externalReference` (sondagem de 13/11/2026: devolve
   * todas as transferências). Por isso a busca percorre as páginas e compara a referência
   * aqui. Confiar no filtro faria um repasse "achar" a transferência de outra loja e nunca
   * sair. Na Fase 3, o registro do repasse no banco da Vitrine é a primeira defesa; esta
   * busca cobre a falha entre "transferiu" e "gravou".
   */
  private async findTransferByReference(reference: string): Promise<AsaasTransfer | undefined> {
    for (let offset = 0; ; offset += TRANSFERS_PAGE_SIZE) {
      const page = await this.http.get<AsaasList<AsaasTransfer>>('/transfers', { offset, limit: TRANSFERS_PAGE_SIZE });
      const found = (page.data ?? []).find((transfer) => transfer.externalReference === reference);
      if (found) return found;
      if (!page.hasMore) return undefined;
    }
  }
}

/** Recusa da operadora: o Asaas responde 400 com um código de cartão inválido/não autorizado. */
function isCardDecline(error: unknown): error is PaymentProviderError {
  return (
    error instanceof PaymentProviderError &&
    error.providerStatus === 400 &&
    error.providerCodes.some((code) => code.toLowerCase().includes('creditcard'))
  );
}
