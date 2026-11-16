import { Module } from '@nestjs/common';

import { SellersModule } from '../sellers/sellers.module.js';
import { ArchiveCategoryUseCase } from './application/archive-category.use-case.js';
import { ArchiveProductUseCase } from './application/archive-product.use-case.js';
import { CATEGORY_REPOSITORY } from './application/category.repository.js';
import { CreateCategoryUseCase } from './application/create-category.use-case.js';
import { CreateProductUseCase } from './application/create-product.use-case.js';
import { GetCategoryTreeUseCase } from './application/get-category-tree.use-case.js';
import { ListMyProductsUseCase } from './application/list-my-products.use-case.js';
import { PRODUCT_REPOSITORY } from './application/product.repository.js';
import { RestoreCategoryUseCase } from './application/restore-category.use-case.js';
import { UpdateCategoryUseCase } from './application/update-category.use-case.js';
import { UpdateProductUseCase } from './application/update-product.use-case.js';
import { AdminCategoriesController } from './http/admin-categories.controller.js';
import { CategoriesController } from './http/categories.controller.js';
import { SellerProductsController } from './http/seller-products.controller.js';
import { PrismaCategoryRepository } from './infra/prisma-category.repository.js';
import { PrismaProductRepository } from './infra/prisma-product.repository.js';

// Catálogo: a árvore de categorias e os produtos das lojas (spec 03). As rotas do
// vendedor usam o guard da loja aprovada, que vem do SellersModule.
@Module({
  imports: [SellersModule],
  controllers: [CategoriesController, AdminCategoriesController, SellerProductsController],
  providers: [
    GetCategoryTreeUseCase,
    CreateCategoryUseCase,
    UpdateCategoryUseCase,
    ArchiveCategoryUseCase,
    RestoreCategoryUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    ArchiveProductUseCase,
    ListMyProductsUseCase,
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
  ],
})
export class CatalogModule {}
