import { Inject, Injectable } from '@nestjs/common';

import { assertCanChange, type Product, type ProductInfo } from '../domain/product.js';
import { SizeGridMismatchError } from '../domain/variant-errors.js';
import { CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';
import { assertLeafCategory } from './create-product.use-case.js';
import { PRODUCT_REPOSITORY, type ProductRef, type ProductRepository } from './product.repository.js';
import { VARIANT_REPOSITORY, type VariantRepository } from './variant.repository.js';

// AC-061, AC-074, AC-075. O slug não muda com o título: o endereço do produto fica estável.
@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(VARIANT_REPOSITORY) private readonly variants: VariantRepository,
  ) {}

  async execute(ref: ProductRef, changes: Partial<ProductInfo>): Promise<Product> {
    const target = changes.categoryId ? await assertLeafCategory(this.categories, changes.categoryId) : null;
    const { product } = await this.products.write(ref, async (current, tx) => {
      assertCanChange(current, 'edit');
      // Uma categoria com outra grade de tamanhos deixaria as variantes ativas com tamanhos
      // fora da lista: só troca com a grade vazia.
      if (target && target.id !== current.categoryId) {
        const from = await this.categories.findById(current.categoryId);
        if (from?.sizeType !== target.sizeType && (await this.variants.countActive(tx, current.id)) > 0) {
          throw new SizeGridMismatchError(target.sizeType);
        }
      }
      return { changes, value: undefined };
    });
    return product;
  }
}
