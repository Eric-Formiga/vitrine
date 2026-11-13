// Porta de pagamento (ADR-0011, ADR-0012): os casos de uso falam com isto, nunca com o
// Asaas. Os tipos são da Vitrine (centavos, nomes do domínio), não os do provedor.
import type { PixKey, PixKeyOwner } from '../domain/pix-key.js';

/** Comprador, como o provedor precisa dele para emitir a cobrança. */
export interface PaymentCustomer {
  name: string;
  /** CPF ou CNPJ, só dígitos ou formatado. */
  document: string;
  email: string;
}

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'OTHER';

/**
 * Situação da cobrança, na linguagem da Vitrine:
 * - CONFIRMED: pago, mas o dinheiro ainda não caiu (cartão: D+32);
 * - RECEIVED: o dinheiro está no saldo da plataforma;
 * - CHARGEBACK: o comprador contestou na operadora (qualquer fase da disputa).
 */
export type PaymentStatus =
  | 'PENDING'
  | 'AWAITING_RISK_ANALYSIS'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'OVERDUE'
  | 'REFUND_IN_PROGRESS'
  | 'REFUNDED'
  | 'CHARGEBACK'
  | 'UNKNOWN';

export interface Payment {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountCents: number;
  /** O que sobra para a plataforma depois da taxa do provedor. */
  netAmountCents: number;
  /** Nossa referência (ex.: id do pedido), devolvida como foi enviada. */
  reference: string | null;
  /** Datas no formato AAAA-MM-DD, como o provedor informa. */
  dueDate: string;
  confirmedOn: string | null;
  receivedOn: string | null;
  /** Quando o dinheiro fica disponível no saldo (cartão: D+32). */
  expectedCreditOn: string | null;
  /** Estornos pedidos nesta cobrança, inclusive os ainda em andamento. */
  refunds: Refund[];
  /** Soma dos estornos que não foram cancelados. */
  refundedAmountCents: number;
}

/**
 * Situação de um estorno. AWAITING_AUTHORIZATION: a conta exige autorizar "ações
 * críticas" (estornos, transferências) antes de o dinheiro sair.
 */
export type RefundStatus = 'PENDING' | 'AWAITING_AUTHORIZATION' | 'DONE' | 'CANCELLED' | 'UNKNOWN';

export interface Refund {
  amountCents: number;
  status: RefundStatus;
  /** AAAA-MM-DD HH:mm:ss, como o provedor informa. */
  requestedAt: string;
}

export interface RefundInput {
  paymentId: string;
  amountCents: number;
  description?: string;
}

/** AWAITING_AUTHORIZATION: igual ao estorno, a conta pode exigir autorizar a transferência. */
export type PixTransferStatus = 'PENDING' | 'AWAITING_AUTHORIZATION' | 'PROCESSING' | 'DONE' | 'CANCELLED' | 'FAILED' | 'UNKNOWN';

export interface PixTransfer {
  id: string;
  status: PixTransferStatus;
  amountCents: number;
  feeCents: number;
  /** Nossa referência (ex.: payout:<id do sub-pedido>): é ela que impede pagar duas vezes. */
  reference: string | null;
  /** AAAA-MM-DD. */
  scheduledOn: string | null;
  doneOn: string | null;
  failReason: string | null;
}

export interface TransferPixInput {
  pixKey: PixKey;
  amountCents: number;
  /** Única por repasse. Repetir a mesma referência devolve a transferência já feita. */
  reference: string;
  description?: string;
}

export interface CreatePixPaymentInput {
  customerId: string;
  amountCents: number;
  /** AAAA-MM-DD. */
  dueDate: string;
  description: string;
  reference: string;
}

export interface CheckoutItem {
  name: string;
  quantity: number;
  unitAmountCents: number;
}

export interface CreateCheckoutInput {
  /** Id do pedido: volta nos avisos do provedor e liga o pagamento ao pedido. */
  reference: string;
  items: CheckoutItem[];
  expiresInMinutes: number;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}

export interface HostedCheckout {
  id: string;
  /** Página de pagamento do provedor, para onde o comprador é levado. */
  url: string;
  methods: PaymentMethod[];
  reference: string | null;
}

export interface PaymentGateway {
  /** Titular da chave Pix. Lança PixKeyNotFoundError se a chave não existe. */
  lookupPixKey(pixKey: PixKey): Promise<PixKeyOwner>;
  /** Id do comprador no provedor: procura pelo documento e só cria se não achar. */
  ensureCustomer(customer: PaymentCustomer): Promise<string>;
  /** Cobrança Pix na conta da plataforma, sem divisão. */
  createPixPayment(input: CreatePixPaymentInput): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment>;
  /** Página de pagamento hospedada (Pix e cartão): o cartão nunca passa pela Vitrine. */
  createCheckout(input: CreateCheckoutInput): Promise<HostedCheckout>;
  /** Saldo disponível da conta da plataforma, em centavos. */
  getAvailableBalanceCents(): Promise<number>;
  /**
   * Estorna parte (ou todo) o valor de uma cobrança e devolve a cobrança atualizada.
   * Lança RefundNotAllowedError se o provedor recusar (ex.: mais do que sobrou).
   */
  refund(input: RefundInput): Promise<Payment>;
  /**
   * Transfere por Pix da conta da plataforma (repasse à loja). Idempotente pela
   * referência: se já existe transferência com ela, devolve essa, sem transferir de novo.
   */
  transferPix(input: TransferPixInput): Promise<PixTransfer>;
  getTransfer(transferId: string): Promise<PixTransfer>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
