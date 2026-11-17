import { Inject, Injectable } from '@nestjs/common';

import { RequestValidationError } from '../../../shared/errors/domain-error.js';
import { assertCanChange, type Product } from '../domain/product.js';
import { ProductNotFoundError } from '../domain/product-errors.js';
import { planGrid, sortVariants, type Variant, type VariantInput } from '../domain/variant.js';
import { CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';
import { PRODUCT_REPOSITORY, type ProductRef, type ProductRepository } from './product.repository.js';
import { VARIANT_REPOSITORY, type VariantRepository } from './variant.repository.js';

export interface ProductVariants {
  product: Product;
  /** As ativas, na ordem da grade de tamanhos. */
  variants: Variant[];
}

// AC-063 a AC-066: a grade inteira de uma vez, na escrita versionada do produto (If-Match).
// Um problema em qualquer linha recusa tudo, e a grade anterior fica como estava.
@Injectable()
export class ReplaceVariantsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(VARIANT_REPOSITORY) private readonly variants: VariantRepository,
  ) {}

  async execute(ref: ProductRef, incoming: readonly VariantInput[]): Promise<ProductVariants> {
    const { product, value } = await this.products.write(ref, async (current, tx) => {
      assertCanChange(current, 'edit');
      const { sizeType } = await sizeTypeOf(this.categories, current.categoryId);
      const existing = await this.variants.findAll(tx, current.id);
      const { issues, plan } = planGrid({ sizeType, productSlug: current.slug, existing, incoming });
      if (issues.length > 0) throw new RequestValidationError(issues);

      const saved = await this.variants.apply(tx, current, plan);
      return { changes: { minPriceCents: plan.minPriceCents }, value: sortVariants(sizeType, saved) };
    });
    return { product, variants: value };
  }
}

/** A grade que o vendedor vê para editar, com a versão do produto (o ETag). */
@Injectable()
export class ListVariantsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
    @Inject(VARIANT_REPOSITORY) private readonly variants: VariantRepository,
  ) {}

  async execute(sellerId: string, productId: string): Promise<ProductVariants> {
    const product = await this.products.findOwned(sellerId, productId);
    if (!product) throw new ProductNotFoundError();
    const { sizeType } = await sizeTypeOf(this.categories, product.categoryId);
    return { product, variants: sortVariants(sizeType, await this.variants.listActive(product.id)) };
  }
}

async function sizeTypeOf(categories: CategoryRepository, categoryId: string) {
  const category = await categories.findById(categoryId);
  // A chave estrangeira garante a categoria; arquivada, ela ainda diz a grade.
  if (!category) throw new Error(`Categoria ${categoryId} do produto não existe.`);
  return category;
}
