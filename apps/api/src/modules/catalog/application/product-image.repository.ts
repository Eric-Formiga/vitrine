import type { ProductImage } from '../domain/product-image.js';
import type { CatalogTransaction } from './product.repository.js';

// Porta: os casos de uso dependem disto, não do Prisma.
export interface ProductImageRepository {
  /** As fotos do produto, na ordem (quem chama já conferiu a loja). */
  list(productId: string): Promise<ProductImage[]>;
  /** Quantas fotos o produto tem, dentro da escrita versionada. */
  count(tx: CatalogTransaction, productId: string): Promise<number>;
  /** Quais destes caminhos a loja registrou ao pedir a URL de upload. */
  registeredUploads(tx: CatalogTransaction, sellerId: string, paths: readonly string[]): Promise<Set<string>>;
  /**
   * Troca a lista inteira na escrita versionada. Os arquivos que saíram e não estão em
   * outro produto ficam marcados para a limpeza (US-030); os que entraram, desmarcados.
   */
  replace(tx: CatalogTransaction, productId: string, images: readonly ProductImage[]): Promise<void>;
}

export const PRODUCT_IMAGE_REPOSITORY = Symbol('PRODUCT_IMAGE_REPOSITORY');
