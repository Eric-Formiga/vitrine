import type { ProductStatus } from '../domain/product.js';
import type { GridPlan, StockChange, Variant } from '../domain/variant.js';
import type { CatalogTransaction } from './product.repository.js';

/** Resultado do ajuste de estoque: o banco decide, numa escrita só, sem ler antes (AC-078). */
export type StockAdjustment =
  | { kind: 'adjusted'; stock: number }
  | { kind: 'not-found' }
  | { kind: 'product-locked'; status: ProductStatus }
  | { kind: 'below-reserved'; stock: number; reserved: number }
  | { kind: 'above-max'; stock: number };

// Porta: os casos de uso dependem disto, não do Prisma.
export interface VariantRepository {
  /** As variantes ativas do produto (quem chama já conferiu a loja). */
  listActive(productId: string): Promise<Variant[]>;
  /** Todas as variantes do produto, inclusive as arquivadas, dentro da escrita versionada. */
  findAll(tx: CatalogTransaction, productId: string): Promise<Variant[]>;
  countActive(tx: CatalogTransaction, productId: string): Promise<number>;
  /**
   * Grava a troca da grade na escrita versionada e devolve as variantes ativas. Lança
   * SkuTakenError se outra variante ativa da loja já usa um dos SKUs (AC-065).
   */
  apply(tx: CatalogTransaction, product: { id: string; sellerId: string }, plan: GridPlan): Promise<Variant[]>;
  /** Ajusta o estoque de uma variante ativa da loja, sem mexer na versão do produto. */
  adjustStock(sellerId: string, variantId: string, change: StockChange): Promise<StockAdjustment>;
}

export const VARIANT_REPOSITORY = Symbol('VARIANT_REPOSITORY');
