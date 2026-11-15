// Loja da Vitrine (spec 02): regras puras, sem Nest nem banco.
import type { PixKeyType } from '../../payments/domain/pix-key.js';
import { InvalidStateTransitionError } from './seller-errors.js';

export const SELLER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

/** Depois de rejeitada, a pessoa só pode se candidatar de novo após este prazo (spec 02). */
export const REAPPLY_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VerifiedPixKey {
  type: PixKeyType;
  key: string;
  ownerName: string;
  /** Como o Asaas devolve, mascarado (ex.: ***.444.777-**). */
  ownerDocument: string;
  verifiedAt: Date;
}

export interface Seller {
  id: string;
  userId: string;
  storeName: string;
  slug: string;
  bio: string;
  instagram: string | null;
  mainCategoryId: string;
  /** Só dígitos, já decifrado. Nunca sai da API sem máscara, a não ser para o admin (ASM-017). */
  document: string;
  status: SellerStatus;
  pixKey: VerifiedPixKey;
  commissionBps: number | null;
  appliedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  suspendedAt: Date | null;
  suspensionReason: string | null;
}

/** Data a partir da qual a loja rejeitada pode se candidatar de novo. */
export function canReapplyAt(rejectedAt: Date): Date {
  return new Date(rejectedAt.getTime() + REAPPLY_AFTER_DAYS * DAY_MS);
}

/**
 * Pode enviar uma candidatura agora? Sem loja: sim. Rejeitada: só depois do prazo.
 * Em análise, aprovada ou suspensa: não (uma candidatura ativa por conta).
 */
export function applicationBlock(existing: Seller | null, now: Date): { blocked: false } | { blocked: true; until?: Date } {
  if (!existing) return { blocked: false };
  if (existing.status !== 'REJECTED' || !existing.rejectedAt) return { blocked: true };
  const until = canReapplyAt(existing.rejectedAt);
  return now < until ? { blocked: true, until } : { blocked: false };
}

export interface SellerChecklist {
  store: boolean;
  pixKey: boolean;
  shipping: boolean;
}

/** O que falta para a loja vender: dados (sempre ok depois da candidatura), chave Pix conferida e frete. */
export function checklistOf(seller: Seller, hasShipping: boolean): SellerChecklist {
  return { store: true, pixKey: Boolean(seller.pixKey.verifiedAt), shipping: hasShipping };
}

// ── Decisões do admin (US-018, US-019) ───────────────────────────────────────

export type SellerDecision =
  | { kind: 'approve' }
  | { kind: 'reject'; reason: string }
  | { kind: 'suspend'; reason: string }
  | { kind: 'reinstate' };

export type SellerDecisionKind = SellerDecision['kind'];

/** De onde cada decisão pode partir e aonde leva. O resto é INVALID_STATE_TRANSITION. */
const TRANSITIONS: Record<SellerDecisionKind, { from: SellerStatus; to: SellerStatus }> = {
  approve: { from: 'PENDING', to: 'APPROVED' },
  reject: { from: 'PENDING', to: 'REJECTED' },
  suspend: { from: 'APPROVED', to: 'SUSPENDED' },
  reinstate: { from: 'SUSPENDED', to: 'APPROVED' },
};

/** Campos da loja que uma decisão do admin muda. */
export interface SellerStatusChange {
  status: SellerStatus;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  suspendedAt?: Date | null;
  suspensionReason?: string | null;
}

/** Aplica a decisão: devolve o que muda, ou recusa se a loja não está na situação de partida. */
export function decide(seller: Pick<Seller, 'status'>, decision: SellerDecision, now: Date): SellerStatusChange {
  const { from, to } = TRANSITIONS[decision.kind];
  if (seller.status !== from) throw new InvalidStateTransitionError(decision.kind, seller.status);

  switch (decision.kind) {
    case 'approve':
      return { status: to, approvedAt: now };
    case 'reject':
      return { status: to, rejectedAt: now, rejectionReason: decision.reason };
    case 'suspend':
      return { status: to, suspendedAt: now, suspensionReason: decision.reason };
    case 'reinstate':
      // A data da primeira aprovação fica; a suspensão sai (o histórico está na auditoria).
      return { status: to, suspendedAt: null, suspensionReason: null };
  }
}

// ── Comissão (US-020) ────────────────────────────────────────────────────────

/** Comissão padrão da plataforma, em pontos-base (12%, RN-3). */
export const DEFAULT_COMMISSION_BPS = 1200;
export const MAX_COMMISSION_BPS = 10_000;

/** A comissão que vale para a loja: a própria, ou a padrão. */
export function effectiveCommissionBps(seller: Pick<Seller, 'commissionBps'>): number {
  return seller.commissionBps ?? DEFAULT_COMMISSION_BPS;
}

/**
 * O que vai para a trilha de auditoria: a situação, as decisões e a comissão.
 * Nunca o CPF/CNPJ (a trilha não é cifrada) nem a chave Pix.
 */
export function auditViewOf(seller: Seller) {
  return {
    status: seller.status,
    storeName: seller.storeName,
    slug: seller.slug,
    commissionBps: seller.commissionBps,
    approvedAt: seller.approvedAt,
    rejectedAt: seller.rejectedAt,
    rejectionReason: seller.rejectionReason,
    suspendedAt: seller.suspendedAt,
    suspensionReason: seller.suspensionReason,
  };
}
