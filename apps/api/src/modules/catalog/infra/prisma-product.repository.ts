import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';
import { AuditTrail } from '../../../shared/audit/audit-trail.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  CatalogTransaction,
  NewProduct,
  ProductChanges,
  ProductRef,
  ProductRepository,
  ProductWork,
} from '../application/product.repository.js';
import { auditViewOf, type Product, type ProductStatus, type ProductSummary } from '../domain/product.js';
import { ProductNotFoundError, ProductVersionConflictError } from '../domain/product-errors.js';

type Row = Prisma.ProductGetPayload<object>;

/** Tentativas de slug antes de desistir (só um título repetido dezenas de vezes chega lá). */
const MAX_SLUG_ATTEMPTS = 50;

const SUMMARY = {
  variants: { where: { archivedAt: null }, select: { stock: true } },
  images: { where: { position: 0 }, select: { path: true }, take: 1 },
} as const;

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrail: AuditTrail,
  ) {}

  async create(data: NewProduct, slugs: Iterable<string>): Promise<Product> {
    let attempts = 0;
    for (const slug of slugs) {
      try {
        return toProduct(await this.prisma.product.create({ data: { ...data, slug } }));
      } catch (error) {
        // O único índice único que a criação pode violar é (seller_id, slug): o banco é
        // quem garante, sem corrida entre checar e gravar. Tenta o próximo.
        const slugTaken = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!slugTaken || ++attempts >= MAX_SLUG_ATTEMPTS) throw error;
      }
    }
    throw new Error('Nenhum slug candidato.');
  }

  async findOwned(sellerId: string, productId: string): Promise<Product | null> {
    const row = await this.prisma.product.findFirst({ where: { id: productId, sellerId } });
    return row ? toProduct(row) : null;
  }

  async listOwned(sellerId: string, status?: ProductStatus): Promise<ProductSummary[]> {
    const rows = await this.prisma.product.findMany({
      where: { sellerId, status },
      include: SUMMARY,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(({ variants, images, ...row }) => ({
      ...toProduct(row),
      coverPath: images[0]?.path ?? null,
      totalStock: variants.reduce((sum, variant) => sum + variant.stock, 0),
    }));
  }

  write<T>(
    { sellerId, productId, expectedVersion }: ProductRef,
    work: (product: Product, tx: CatalogTransaction) => Promise<ProductWork<T>>,
  ): Promise<{ product: Product; value: T }> {
    return this.prisma.$transaction(async (tx) => {
      // Trava a linha: duas escritas no mesmo produto entram uma de cada vez, e a segunda
      // já lê a versão que a primeira gravou (e recebe 412).
      await tx.$executeRaw`SELECT 1 FROM products WHERE id = ${productId}::uuid AND seller_id = ${sellerId}::uuid FOR UPDATE`;
      const row = await tx.product.findFirst({ where: { id: productId, sellerId } });
      if (!row) throw new ProductNotFoundError();
      if (row.version !== expectedVersion) throw new ProductVersionConflictError(row.version);

      const { changes, value } = await work(toProduct(row), asCatalogTransaction(tx));
      const saved = await tx.product.update({ where: { id: productId }, data: { ...changes, version: { increment: 1 } } });
      return { product: toProduct(saved), value };
    });
  }

  moderate(productId: string, decide: (product: Product) => ProductChanges): Promise<Product> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      const row = await tx.product.findUnique({ where: { id: productId } });
      if (!row) throw new ProductNotFoundError();

      const before = toProduct(row);
      const saved = toProduct(
        await tx.product.update({ where: { id: productId }, data: { ...decide(before), version: { increment: 1 } } }),
      );
      await this.auditTrail.record(tx, { entityType: 'product', entityId: productId, before: auditViewOf(before), after: auditViewOf(saved) });
      return saved;
    });
  }
}

/** A transação do Prisma vista pela aplicação: um valor opaco que só a infra abre. */
function asCatalogTransaction(tx: Prisma.TransactionClient): CatalogTransaction {
  return tx as unknown as CatalogTransaction;
}

/** O inverso, para os repositórios de variantes e imagens gravarem na mesma transação. */
export function prismaTransactionOf(tx: CatalogTransaction): Prisma.TransactionClient {
  return tx as unknown as Prisma.TransactionClient;
}

function toProduct(row: Row): Product {
  return row;
}
