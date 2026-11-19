import { Module } from '@nestjs/common';

import { SellersModule } from '../sellers/sellers.module.js';
import { AdjustStockUseCase } from './application/adjust-stock.use-case.js';
import { ArchiveCategoryUseCase } from './application/archive-category.use-case.js';
import { ArchiveProductUseCase } from './application/archive-product.use-case.js';
import { CATEGORY_REPOSITORY } from './application/category.repository.js';
import { CreateCategoryUseCase } from './application/create-category.use-case.js';
import { CreateProductUseCase } from './application/create-product.use-case.js';
import { GetCategoryTreeUseCase } from './application/get-category-tree.use-case.js';
import { ListMyProductsUseCase } from './application/list-my-products.use-case.js';
import { ModerateProductUseCase } from './application/moderate-product.use-case.js';
import { PRODUCT_REPOSITORY } from './application/product.repository.js';
import { PRODUCT_IMAGE_REPOSITORY } from './application/product-image.repository.js';
import { PublishProductUseCase } from './application/publish-product.use-case.js';
import { ListImagesUseCase, ReplaceImagesUseCase } from './application/replace-images.use-case.js';
import { ListVariantsUseCase, ReplaceVariantsUseCase } from './application/replace-variants.use-case.js';
import { RestoreCategoryUseCase } from './application/restore-category.use-case.js';
import { UpdateCategoryUseCase } from './application/update-category.use-case.js';
import { UpdateProductUseCase } from './application/update-product.use-case.js';
import { VARIANT_REPOSITORY } from './application/variant.repository.js';
import { AdminCategoriesController } from './http/admin-categories.controller.js';
import { AdminProductsController } from './http/admin-products.controller.js';
import { CategoriesController } from './http/categories.controller.js';
import { SellerProductImagesController } from './http/seller-product-images.controller.js';
import { SellerProductsController } from './http/seller-products.controller.js';
import { SellerVariantsController } from './http/seller-variants.controller.js';
import { PrismaCategoryRepository } from './infra/prisma-category.repository.js';
import { PrismaProductRepository } from './infra/prisma-product.repository.js';
import { PrismaProductImageRepository } from './infra/prisma-product-image.repository.js';
import { PrismaVariantRepository } from './infra/prisma-variant.repository.js';

// Catálogo: a árvore de categorias e os produtos das lojas (spec 03). As rotas do
// vendedor usam o guard da loja aprovada, que vem do SellersModule; as fotos usam a porta
// do Storage, que o MediaModule (global) fornece.
@Module({
  imports: [SellersModule],
  controllers: [
    CategoriesController,
    AdminCategoriesController,
    SellerProductsController,
    SellerVariantsController,
    SellerProductImagesController,
    AdminProductsController,
  ],
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
    ListVariantsUseCase,
    ReplaceVariantsUseCase,
    AdjustStockUseCase,
    ListImagesUseCase,
    ReplaceImagesUseCase,
    PublishProductUseCase,
    ModerateProductUseCase,
    { provide: PRODUCT_IMAGE_REPOSITORY, useClass: PrismaProductImageRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: VARIANT_REPOSITORY, useClass: PrismaVariantRepository },
  ],
})
export class CatalogModule {}
