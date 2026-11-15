// Loja da Vitrine (spec 02): regras puras, sem Nest nem banco.
import type { PixKeyType } from '../../payments/domain/pix-key.js';

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
