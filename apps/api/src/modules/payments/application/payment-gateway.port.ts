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
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
