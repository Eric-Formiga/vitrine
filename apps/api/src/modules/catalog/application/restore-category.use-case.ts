import { Inject, Injectable } from '@nestjs/common';

import type { Category } from '../domain/category.js';
import { CategoryNotFoundError, InvalidCategoryParentError } from '../domain/category-errors.js';
import { CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';

// Restaurar (AC-033): só a categoria escolhida volta; as descendentes continuam
// arquivadas. Exige a pai ativa, para nunca existir categoria ativa sob uma arquivada.
@Injectable()
export class RestoreCategoryUseCase {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(id: string): Promise<Category> {
    return this.categories.write(async (session) => {
      const all = await session.findAll();
      const current = all.find((c) => c.id === id);
      if (!current) throw new CategoryNotFoundError();
      if (!current.archivedAt) return current; // já ativa: nada muda

      const parent = current.parentId ? all.find((c) => c.id === current.parentId) : undefined;
      if (parent?.archivedAt) throw new InvalidCategoryParentError('archived');

      await session.setArchivedAt([id], null);
      const restored = { ...current, archivedAt: null };
      await session.audit(id, current, restored);
      return restored;
    });
  }
}
