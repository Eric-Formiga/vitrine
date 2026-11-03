import { Inject, Injectable } from '@nestjs/common';

import { descendantIds } from '../domain/category.js';
import { CategoryNotFoundError } from '../domain/category-errors.js';
import { CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';

// Arquivar em cascata (AC-029, ASM-011): a categoria e todas as descendentes ainda ativas
// ganham a mesma data em archived_at. Nada é apagado e o slug continua reservado.
@Injectable()
export class ArchiveCategoryUseCase {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(id: string): Promise<void> {
    await this.categories.write(async (session) => {
      const all = await session.findAll();
      const current = all.find((c) => c.id === id);
      if (!current) throw new CategoryNotFoundError();
      if (current.archivedAt) return; // já arquivada: nada muda, nada a registrar

      const archivedAt = new Date();
      const activeDescendants = descendantIds(all, id).filter((d) => !all.find((c) => c.id === d)?.archivedAt);
      await session.setArchivedAt([id, ...activeDescendants], archivedAt);
      await session.audit(id, current, { ...current, archivedAt, archivedDescendantIds: activeDescendants });
    });
  }
}
