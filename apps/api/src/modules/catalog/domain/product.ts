// Produto de uma loja (spec 03): regras puras, sem Nest nem banco (ADR-0002).
import { slugify } from '../../../shared/text/slugify.js';
import { InvalidProductStateError, type ProductAction } from './product-errors.js';

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_CONDITIONS = ['NEW', 'USED'] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
/** Texto puro, com as quebras de linha (ASM-025). */
export const DESCRIPTION_MAX = 5000;

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string;
  condition: ProductCondition;
  status: ProductStatus;
  /** Sobe a cada escrita; é o ETag (ASM-026). */
  version: number;
  /** Preço da variante ativa mais barata; nulo sem variantes. */
  minPriceCents: number | null;
  publishedAt: Date | null;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Linha da lista "meus produtos" (AC-062). */
export interface ProductSummary extends Product {
  /** Caminho no Storage da imagem de posição 0; nulo sem imagens. */
  coverPath: string | null;
  /** Soma do estoque das variantes ativas. */
  totalStock: number;
}

export interface ProductInfo {
  title: string;
  description: string;
  categoryId: string;
  condition: ProductCondition;
}

/**
 * Slugs para tentar, em ordem, até um não estar ocupado na loja:
 * "vestido-midi", "vestido-midi-2", "vestido-midi-3"... (AC-060).
 * Título sem letra nem número aproveitável vira "produto".
 */
export function* slugCandidates(title: string): Generator<string> {
  const base = slugify(title).slice(0, 80).replace(/-+$/, '') || 'produto';
  yield base;
  for (let n = 2; ; n++) yield `${base}-${n}`;
}

/** Arquivado é final (ASM-030): nada mais muda nele. */
export function assertCanChange(product: Pick<Product, 'status'>, action: ProductAction): void {
  if (product.status === 'ARCHIVED') throw new InvalidProductStateError(action, product.status);
}
