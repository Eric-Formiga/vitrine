import type { Seller, VerifiedPixKey } from '../domain/seller.js';

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
  /** A loja já configurou o frete? (a tabela de frete chega na T-018) */
  hasShipping(sellerId: string): Promise<boolean>;
}

export const SELLER_REPOSITORY = Symbol('SELLER_REPOSITORY');
