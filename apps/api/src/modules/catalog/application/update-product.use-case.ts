import { Inject, Injectable } from '@nestjs/common';

import { assertCanChange, type Product, type ProductInfo } from '../domain/product.js';
import { CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';
import { assertLeafCategory } from './create-product.use-case.js';
import { PRODUCT_REPOSITORY, type ProductRef, type ProductRepository } from './product.repository.js';

// AC-061, AC-074, AC-075. O slug não muda com o título: o endereço do produto fica estável.
@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  async execute(ref: ProductRef, changes: Partial<ProductInfo>): Promise<Product> {
    if (changes.categoryId) await assertLeafCategory(this.categories, changes.categoryId);
    const { product } = await this.products.write(ref, async (current) => {
      assertCanChange(current, 'edit');
      return { changes, value: undefined };
    });
    return product;
  }
}
