import { Inject, Injectable } from '@nestjs/common';

import { buildTree, type CategoryNode } from '../domain/category.js';
import { CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';

// A árvore pública (só ativas, AC-023) ou a do admin (com as arquivadas, AC-029).
@Injectable()
export class GetCategoryTreeUseCase {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute({ includeArchived = false } = {}): Promise<CategoryNode[]> {
    const all = await this.categories.findAll();
    return buildTree(includeArchived ? all : all.filter((c) => c.archivedAt === null));
  }
}
