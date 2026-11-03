import { Inject, Injectable } from '@nestjs/common';

import { RequestValidationError } from '../../../shared/errors/domain-error.js';
import type { Category, SizeType } from '../domain/category.js';
import { InvalidCategoryParentError, parentNotFound } from '../domain/category-errors.js';
import type { SizeChart } from '../domain/size-chart.js';
import { slugify } from '../domain/slugify.js';
import { CATEGORY_REPOSITORY, type CategoryRepository } from './category.repository.js';

export interface CreateCategoryInput {
  name: string;
  sizeType: SizeType;
  slug?: string;
  parentId?: string | null;
  position?: number;
  sizeChart?: SizeChart | null;
}

// AC-026, AC-027, AC-028 (pai arquivada), AC-030.
@Injectable()
export class CreateCategoryUseCase {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly categories: CategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) {
      throw new RequestValidationError([
        { field: 'slug', message: 'Não deu para gerar o slug a partir do nome. Informe um slug.' },
      ]);
    }

    return this.categories.write(async (session) => {
      const parentId = input.parentId ?? null;
      if (parentId) assertUsableParent(await session.findAll(), parentId);

      const created = await session.insert({
        name: input.name,
        slug,
        parentId,
        position: input.position ?? 0,
        sizeType: input.sizeType,
        sizeChart: input.sizeChart ?? null,
      });
      await session.audit(created.id, null, created);
      return created;
    });
  }
}

/** A pai precisa existir (senão 400) e estar ativa (senão 422). */
export function assertUsableParent(all: readonly Category[], parentId: string): void {
  const parent = all.find((c) => c.id === parentId);
  if (!parent) throw parentNotFound();
  if (parent.archivedAt) throw new InvalidCategoryParentError('archived');
}
