import type { Product, ProductInfo, ProductStatus, ProductSummary } from '../domain/product.js';

export interface NewProduct extends ProductInfo {
  sellerId: string;
}

export type ProductChanges = Partial<ProductInfo> &
  Partial<Pick<Product, 'status' | 'minPriceCents' | 'publishedAt' | 'suspendedAt' | 'suspensionReason' | 'archivedAt'>>;

/**
 * A transação de uma escrita versionada, opaca para a aplicação. Os outros repositórios
 * do catálogo (variantes, imagens) a recebem para gravar junto com o produto.
 */
export interface CatalogTransaction {
  readonly kind: 'catalog-transaction';
}

/** Qual produto, de qual loja, e a versão que quem chama diz estar editando (If-Match). */
export interface ProductRef {
  sellerId: string;
  productId: string;
  expectedVersion: number;
}

export interface ProductWork<T> {
  changes: ProductChanges;
  value: T;
}

// Porta: os casos de uso dependem disto, não do Prisma.
export interface ProductRepository {
  /** Grava com o primeiro slug livre na loja, na ordem de `slugs`. */
  create(data: NewProduct, slugs: Iterable<string>): Promise<Product>;
  /** O produto, se for da loja; o de outra loja é como se não existisse. */
  findOwned(sellerId: string, productId: string): Promise<Product | null>;
  /** Do mais recente para o mais antigo. */
  listOwned(sellerId: string, status?: ProductStatus): Promise<ProductSummary[]>;
  /**
   * Escrita versionada (ASM-026): trava o produto da loja, confere a versão (senão 404 ou
   * 412), roda o trabalho e grava as mudanças com a versão + 1, tudo na mesma transação.
   */
  write<T>(ref: ProductRef, work: (product: Product, tx: CatalogTransaction) => Promise<ProductWork<T>>): Promise<{ product: Product; value: T }>;
  /**
   * Escrita do admin (moderação): trava o produto pelo id, de qualquer loja, sem conferir
   * versão, mas sobe a versão, para a aba do vendedor perceber. O antes e o depois vão
   * para a trilha de auditoria na mesma transação (ASM-028). Produto inexistente: 404.
   */
  moderate(productId: string, decide: (product: Product) => ProductChanges): Promise<Product>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
