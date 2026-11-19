import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { ProductImageRepository } from '../application/product-image.repository.js';
import type { CatalogTransaction } from '../application/product.repository.js';
import type { ProductImage } from '../domain/product-image.js';
import { prismaTransactionOf } from './prisma-product.repository.js';

const IMAGE = { path: true, alt: true, position: true, color: true } as const;

// As fotos ficam no catálogo; a tabela `uploads` é do módulo media, mas a troca precisa
// marcá-la na mesma transação (a chave estrangeira de product_images aponta para ela).
@Injectable()
export class PrismaProductImageRepository implements ProductImageRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(productId: string): Promise<ProductImage[]> {
    return this.prisma.productImage.findMany({ where: { productId }, select: IMAGE, orderBy: { position: 'asc' } });
  }

  count(tx: CatalogTransaction, productId: string): Promise<number> {
    return prismaTransactionOf(tx).productImage.count({ where: { productId } });
  }

  async registeredUploads(tx: CatalogTransaction, sellerId: string, paths: readonly string[]): Promise<Set<string>> {
    const rows = await prismaTransactionOf(tx).upload.findMany({
      where: { sellerId, path: { in: [...paths] } },
      select: { path: true },
    });
    return new Set(rows.map((row) => row.path));
  }

  async replace(tx: CatalogTransaction, productId: string, images: readonly ProductImage[]): Promise<void> {
    const db = prismaTransactionOf(tx);
    const before = await db.productImage.findMany({ where: { productId }, select: { path: true } });
    await db.productImage.deleteMany({ where: { productId } });
    await db.productImage.createMany({ data: images.map((image) => ({ ...image, productId })) });

    const kept = new Set(images.map((image) => image.path));
    const left = before.map((image) => image.path).filter((path) => !kept.has(path));
    // Um arquivo pode estar em mais de um produto da loja: só vai para a limpeza quando
    // nenhum produto o usa mais.
    await db.upload.updateMany({
      where: { path: { in: left }, images: { none: {} } },
      data: { detachedAt: new Date() },
    });
    await db.upload.updateMany({ where: { path: { in: [...kept] } }, data: { detachedAt: null } });
  }
}
