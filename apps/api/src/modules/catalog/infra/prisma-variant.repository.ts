import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { CatalogTransaction } from '../application/product.repository.js';
import type { StockAdjustment, VariantRepository } from '../application/variant.repository.js';
import { type GridPlan, STOCK_MAX, type StockChange, type Variant } from '../domain/variant.js';
import { SkuTakenError } from '../domain/variant-errors.js';
import { prismaTransactionOf } from './prisma-product.repository.js';

const VARIANT = {
  id: true,
  productId: true,
  sellerId: true,
  sku: true,
  size: true,
  color: true,
  colorHex: true,
  priceCents: true,
  compareAtCents: true,
  stock: true,
  reserved: true,
  weightGrams: true,
  archivedAt: true,
} as const satisfies Prisma.ProductVariantSelect;

@Injectable()
export class PrismaVariantRepository implements VariantRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActive(productId: string): Promise<Variant[]> {
    return this.prisma.productVariant.findMany({ where: { productId, archivedAt: null }, select: VARIANT });
  }

  findAll(tx: CatalogTransaction, productId: string): Promise<Variant[]> {
    return prismaTransactionOf(tx).productVariant.findMany({ where: { productId }, select: VARIANT });
  }

  countActive(tx: CatalogTransaction, productId: string): Promise<number> {
    return prismaTransactionOf(tx).productVariant.count({ where: { productId, archivedAt: null } });
  }

  async apply(tx: CatalogTransaction, product: { id: string; sellerId: string }, plan: GridPlan): Promise<Variant[]> {
    const db = prismaTransactionOf(tx);
    const skus = [...plan.update.map(({ data }) => data.sku), ...plan.create.map((data) => data.sku)];
    // Conferir antes dá o SKU exato na resposta; o índice parcial ainda segura uma corrida.
    const taken = await db.productVariant.findFirst({
      where: { sellerId: product.sellerId, sku: { in: skus }, archivedAt: null, productId: { not: product.id } },
      select: { sku: true },
    });
    if (taken) throw new SkuTakenError(taken.sku);

    try {
      // Arquivar primeiro libera os SKUs de quem sai para quem entra.
      await db.productVariant.updateMany({ where: { id: { in: plan.archive } }, data: { archivedAt: new Date() } });
      for (const { id, data } of plan.update) {
        await db.productVariant.update({ where: { id }, data: { ...data, archivedAt: null } });
      }
      await db.productVariant.createMany({
        data: plan.create.map((data) => ({ ...data, productId: product.id, sellerId: product.sellerId })),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new SkuTakenError(null);
      throw error;
    }

    // As fotos de uma cor que saiu da grade passam a valer para todas (ASM-027).
    await db.$executeRaw`
      UPDATE product_images SET color = NULL
      WHERE product_id = ${product.id}::uuid AND color IS NOT NULL AND lower(color) <> ALL(${plan.colors}::text[])`;

    return db.productVariant.findMany({ where: { productId: product.id, archivedAt: null }, select: VARIANT });
  }

  async adjustStock(sellerId: string, variantId: string, change: StockChange): Promise<StockAdjustment> {
    const next = 'delta' in change ? Prisma.sql`v.stock + ${change.delta}::int` : Prisma.sql`${change.absolute}::int`;
    // Uma escrita só: a condição e a soma acontecem com a linha travada, então ajustes
    // simultâneos se enfileiram e nenhum se perde (AC-078).
    const [row] = await this.prisma.$queryRaw<{ stock: number }[]>`
      UPDATE product_variants v SET stock = ${next}, updated_at = now()
      FROM products p
      WHERE v.id = ${variantId}::uuid AND v.seller_id = ${sellerId}::uuid AND v.archived_at IS NULL
        AND p.id = v.product_id AND p.status <> 'ARCHIVED'
        AND ${next} >= v.reserved AND ${next} <= ${STOCK_MAX}::int
      RETURNING v.stock`;
    if (row) return { kind: 'adjusted', stock: row.stock };

    // Não gravou: descobre por quê, para responder com o erro certo.
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, sellerId, archivedAt: null },
      select: { stock: true, reserved: true, product: { select: { status: true } } },
    });
    if (!variant) return { kind: 'not-found' };
    if (variant.product.status === 'ARCHIVED') return { kind: 'product-locked', status: variant.product.status };
    const wanted = 'delta' in change ? variant.stock + change.delta : change.absolute;
    return wanted > STOCK_MAX
      ? { kind: 'above-max', stock: variant.stock }
      : { kind: 'below-reserved', stock: variant.stock, reserved: variant.reserved };
  }
}
