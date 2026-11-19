import { Inject, Injectable } from '@nestjs/common';

import { type Product, publishIssues, transition } from '../domain/product.js';
import { ProductNotPublishableError } from '../domain/product-errors.js';
import { PRODUCT_IMAGE_REPOSITORY, type ProductImageRepository } from './product-image.repository.js';
import { PRODUCT_REPOSITORY, type ProductRef, type ProductRepository } from './product.repository.js';
import { VARIANT_REPOSITORY, type VariantRepository } from './variant.repository.js';

// AC-071, AC-072: o rascunho vira ativo só completo (foto e variante com estoque), na
// escrita versionada (If-Match). A situação é conferida antes do conteúdo.
@Injectable()
export class PublishProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepository,
    @Inject(VARIANT_REPOSITORY) private readonly variants: VariantRepository,
  ) {}

  async execute(ref: ProductRef, now = new Date()): Promise<Product> {
    const { product } = await this.products.write(ref, async (current, tx) => {
      const change = transition(current, { kind: 'publish' }, now);
      const imageCount = await this.images.count(tx, current.id);
      const activeStocks = (await this.variants.findAll(tx, current.id)).filter((v) => !v.archivedAt).map((v) => v.stock);
      const missing = publishIssues({ imageCount, activeStocks });
      if (missing.length > 0) throw new ProductNotPublishableError(missing);
      return { changes: change, value: undefined };
    });
    return product;
  }
}
