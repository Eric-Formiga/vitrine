import { Inject, Injectable } from '@nestjs/common';

import { type Category, wouldCreateCycle } from '../domain/category.js';
import { CategoryNotFoundError, InvalidCategoryParentError } from '../domain/category-errors.js';
import { type CategoryChanges, CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';
import { assertUsableParent } from './create-category.use-case.js';

// Editar e mover (AC-028), com auditoria (AC-030).
@Injectable()
export class UpdateCategoryUseCase {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(id: string, changes: CategoryChanges): Promise<Category> {
    return this.categories.write(async (session) => {
      const all = await session.findAll();
      const current = all.find((c) => c.id === id);
      if (!current) throw new CategoryNotFoundError();

      const newParentId = changes.parentId;
      if (newParentId && newParentId !== current.parentId) {
        // Ciclo primeiro: mover para dentro de si mesma é 422 mesmo que ela esteja arquivada.
        if (wouldCreateCycle(all, id, newParentId)) throw new InvalidCategoryParentError('cycle');
        assertUsableParent(all, newParentId);
      }

      const updated = await session.update(id, changes);
      await session.audit(id, current, updated);
      return updated;
    });
  }
}
