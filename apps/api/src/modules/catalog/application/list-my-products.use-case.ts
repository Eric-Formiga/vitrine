import { Inject, Injectable } from '@nestjs/common';

import type { Product, ProductStatus, ProductSummary } from '../domain/product.js';
import { ProductNotFoundError } from '../domain/product-errors.js';
import { PRODUCT_REPOSITORY, type ProductRepository } from './product.repository.js';

// AC-062: só os produtos da loja de quem chama; o de outra loja é 404.
@Injectable()
export class ListMyProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  list(sellerId: string, status?: ProductStatus): Promise<ProductSummary[]> {
    return this.products.listOwned(sellerId, status);
  }

  async get(sellerId: string, productId: string): Promise<Product> {
    const product = await this.products.findOwned(sellerId, productId);
    if (!product) throw new ProductNotFoundError();
    return product;
  }
}
