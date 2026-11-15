import type { Role } from '../../../shared/auth/roles.decorator.js';
import type { Seller, SellerStatus, SellerStatusChange, VerifiedPixKey } from '../domain/seller.js';
import type { ShippingSettings } from '../domain/shipping.js';

/** A loja com a conta dona, como o admin vê (AC-050). */
export interface SellerWithOwner extends Seller {
  owner: { id: string; name: string | null; email: string };
}

/** O que dá para mudar numa loja dentro de uma escrita (admin ou a própria loja). */
export type SellerChanges = Partial<SellerStatusChange> & { commissionBps?: number | null; pixKey?: VerifiedPixKey };

/** Uma transação sobre UMA loja: tudo aqui entra junto, ou nada entra. */
export interface SellerWriteSession {
  /** Lê a loja travando a linha até o fim da transação (duas decisões ao mesmo tempo não se cruzam). */
  lockById(id: string): Promise<SellerWithOwner | null>;
  update(id: string, changes: SellerChanges): Promise<SellerWithOwner>;
  grantRole(userId: string, role: Role): Promise<void>;
  audit(entityId: string, before: unknown, after: unknown): Promise<void>;
}

/** Dados de uma candidatura, já validados e com a chave Pix conferida. `document`: só dígitos. */
export interface SellerApplicationData {
  userId: string;
  storeName: string;
  slug: string;
  bio: string;
  instagram: string | null;
  mainCategoryId: string;
  document: string;
  pixKey: VerifiedPixKey;
}

// Porta das lojas: o caso de uso não conhece o Prisma nem a cifra do documento.
export interface SellerRepository {
  findByUserId(userId: string): Promise<Seller | null>;
  /** A categoria existe e não está arquivada? */
  isActiveCategory(categoryId: string): Promise<boolean>;
  /** Slug ou documento (pelo hash) já usados por outra conta? */
  findConflicts(query: { slug: string; documentHash: string; exceptUserId: string }): Promise<{
    slugTaken: boolean;
    documentTaken: boolean;
  }>;
  /** Cria a loja em análise. O índice único é a última palavra: SLUG_TAKEN / DOCUMENT_TAKEN. */
  createApplication(data: SellerApplicationData): Promise<Seller>;
  /** Loja rejeitada volta para análise com os dados novos (AC-047). */
  reapply(sellerId: string, data: SellerApplicationData): Promise<Seller>;
  /** A loja já configurou o frete? */
  hasShipping(sellerId: string): Promise<boolean>;
  findShipping(sellerId: string): Promise<ShippingSettings | null>;
  /** Cria ou substitui a configuração de frete da loja (AC-057). */
  saveShipping(sellerId: string, settings: ShippingSettings): Promise<ShippingSettings>;
  /** Lojas numa situação, da candidatura mais antiga para a mais nova (AC-050). */
  listByStatus(status: SellerStatus): Promise<SellerWithOwner[]>;
  /** Transação de escrita do admin sobre uma loja. */
  write<T>(work: (session: SellerWriteSession) => Promise<T>): Promise<T>;
}

export const SELLER_REPOSITORY = Symbol('SELLER_REPOSITORY');
