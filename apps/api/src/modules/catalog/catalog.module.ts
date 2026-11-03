import { Module } from '@nestjs/common';

import { ArchiveCategoryUseCase } from './application/archive-category.use-case.js';
import { CATEGORY_REPOSITORY } from './application/category.repository.js';
import { CreateCategoryUseCase } from './application/create-category.use-case.js';
import { GetCategoryTreeUseCase } from './application/get-category-tree.use-case.js';
import { RestoreCategoryUseCase } from './application/restore-category.use-case.js';
import { UpdateCategoryUseCase } from './application/update-category.use-case.js';
import { AdminCategoriesController } from './http/admin-categories.controller.js';
import { CategoriesController } from './http/categories.controller.js';
import { PrismaCategoryRepository } from './infra/prisma-category.repository.js';

// Catálogo: por enquanto, a árvore de categorias. Produtos chegam na feature `produtos`.
@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [
    GetCategoryTreeUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    ArchiveCategoryUseCase,
    RestoreCategoryUseCase,
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
  ],
})
export class CatalogModule {}
