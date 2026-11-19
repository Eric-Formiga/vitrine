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

// ── Situação ──────────────────────────────────────────────────────────────────

/** Mudanças de situação: publicar e arquivar (vendedor), suspender e reativar (admin). */
export type ProductTransition =
  | { kind: 'publish' }
  | { kind: 'suspend'; reason: string }
  | { kind: 'reinstate' }
  | { kind: 'archive' };

export type ProductStatusChange = Pick<Product, 'status'> &
  Partial<Pick<Product, 'publishedAt' | 'suspendedAt' | 'suspensionReason' | 'archivedAt'>>;

/** De onde cada mudança pode partir; o resto é INVALID_STATE_TRANSITION. */
const ALLOWED_FROM: Record<ProductTransition['kind'], readonly ProductStatus[]> = {
  publish: ['DRAFT'],
  suspend: ['ACTIVE'],
  reinstate: ['SUSPENDED'],
  archive: ['DRAFT', 'ACTIVE', 'SUSPENDED'],
};

export function transition(product: Pick<Product, 'status'>, change: ProductTransition, now: Date): ProductStatusChange {
  if (!ALLOWED_FROM[change.kind].includes(product.status)) throw new InvalidProductStateError(change.kind, product.status);
  switch (change.kind) {
    case 'publish':
      return { status: 'ACTIVE', publishedAt: now };
    case 'suspend':
      return { status: 'SUSPENDED', suspendedAt: now, suspensionReason: change.reason };
    case 'reinstate':
      // A data da primeira publicação continua: o produto não "nasce" de novo.
      return { status: 'ACTIVE', suspendedAt: null, suspensionReason: null };
    case 'archive':
      return { status: 'ARCHIVED', archivedAt: now };
  }
}

// ── Completo para vender ──────────────────────────────────────────────────────

/**
 * O que falta para o produto estar à venda:
 * - `images`: nenhuma foto;
 * - `stock`: nenhuma variante ativa com estoque (só para publicar);
 * - `variants`: nenhuma variante ativa (para o produto já publicado).
 */
export type PublishGap = 'images' | 'stock' | 'variants';

export interface ProductContents {
  imageCount: number;
  /** Estoque de cada variante ativa. */
  activeStocks: readonly number[];
}

/** Para publicar (AC-071, AC-072): pelo menos uma foto e uma variante com estoque. */
export function publishIssues({ imageCount, activeStocks }: ProductContents): PublishGap[] {
  const gaps: PublishGap[] = [];
  if (imageCount === 0) gaps.push('images');
  if (!activeStocks.some((stock) => stock > 0)) gaps.push('stock');
  return gaps;
}

/**
 * O produto publicado (ativo, ou suspenso, que volta a ativo) continua com foto e com
 * grade (AC-073). Estoque zero pode: ele fica à venda, mas esgotado.
 */
export function listedIssues(product: Pick<Product, 'status'>, { imageCount, activeStocks }: ProductContents): PublishGap[] {
  if (product.status !== 'ACTIVE' && product.status !== 'SUSPENDED') return [];
  const gaps: PublishGap[] = [];
  if (imageCount === 0) gaps.push('images');
  if (activeStocks.length === 0) gaps.push('variants');
  return gaps;
}

/** O que vai para a trilha de auditoria na moderação (ASM-028). */
export function auditViewOf(product: Product) {
  return {
    status: product.status,
    suspensionReason: product.suspensionReason,
    suspendedAt: product.suspendedAt,
    version: product.version,
  };
}
