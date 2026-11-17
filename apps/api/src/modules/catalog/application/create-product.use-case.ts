import { Inject, Injectable } from '@nestjs/common';

import { RequestValidationError } from '../../../shared/errors/domain-error.js';
import { type Product, type ProductInfo, slugCandidates } from '../domain/product.js';
import { CATEGORY_REPOSITORY, type CategoryRepository, type CategoryWithChildren } from './category.repository.js';
import { PRODUCT_REPOSITORY, type ProductRepository } from './product.repository.js';

// AC-060, AC-061.
@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository,
  ) {}

  async execute(sellerId: string, info: ProductInfo): Promise<Product> {
    await assertLeafCategory(this.categories, info.categoryId);
    return this.products.create({ ...info, sellerId }, slugCandidates(info.title));
  }
}

/**
 * Produto só vai numa categoria ativa e sem subcategorias ativas (ASM-023): erro de
 * entrada, no formato da validação (400 com o campo), como a categoria pai.
 */
export async function assertLeafCategory(categories: CategoryRepository, categoryId: string): Promise<CategoryWithChildren> {
  const invalid = (message: string) => new RequestValidationError([{ field: 'categoryId', message }]);
  const category = await categories.findById(categoryId);
  if (!category || category.archivedAt) throw invalid('Escolha uma categoria ativa.');
  if (category.hasActiveChildren) throw invalid(`Escolha uma subcategoria de "${category.name}" (a mais específica).`);
  return category;
}
