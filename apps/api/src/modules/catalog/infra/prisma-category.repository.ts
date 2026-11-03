import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';
import { AuditTrail } from '../../../shared/audit/audit-trail.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type {
  CategoryChanges,
  CategoryRepository,
  CategoryWriteSession,
  NewCategory,
} from '../application/category.repository.js';
import type { Category } from '../domain/category.js';
import { SlugTakenError } from '../domain/category-errors.js';
import type { SizeChart } from '../domain/size-chart.js';

const COLUMNS = {
  id: true,
  parentId: true,
  name: true,
  slug: true,
  position: true,
  sizeType: true,
  sizeChart: true,
  archivedAt: true,
} as const;

type Row = Prisma.CategoryGetPayload<{ select: typeof COLUMNS }>;
type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  findAll(): Promise<Category[]> {
    return findAll(this.prisma);
  }

  write<T>(work: (session: CategoryWriteSession) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Conflita só com outra escrita em categorias; leituras continuam livres.
      await tx.$executeRaw`LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE`;
      return work(this.session(tx));
    });
  }

  private session(tx: Prisma.TransactionClient): CategoryWriteSession {
    return {
      findAll: () => findAll(tx),
      insert: (data: NewCategory) =>
        withSlugCheck(data.slug, async () =>
          toCategory(await tx.category.create({ data: { ...data, sizeChart: json(data.sizeChart) }, select: COLUMNS })),
        ),
      update: (id: string, changes: CategoryChanges) =>
        withSlugCheck(changes.slug, async () =>
          toCategory(
            await tx.category.update({
              where: { id },
              data: { ...changes, sizeChart: changes.sizeChart === undefined ? undefined : json(changes.sizeChart) },
              select: COLUMNS,
            }),
          ),
        ),
      setArchivedAt: async (ids: string[], at: Date | null) => {
        await tx.category.updateMany({ where: { id: { in: ids } }, data: { archivedAt: at } });
      },
      audit: (entityId: string, before: unknown, after: unknown) =>
        this.trail.record(tx, { entityType: 'category', entityId, before, after }),
    };
  }
}

async function findAll(db: Db): Promise<Category[]> {
  return (await db.category.findMany({ select: COLUMNS })).map(toCategory);
}

function toCategory(row: Row): Category {
  return { ...row, sizeChart: row.sizeChart as SizeChart | null };
}

function json(chart: SizeChart | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return chart === null ? Prisma.DbNull : (chart as unknown as Prisma.InputJsonValue);
}

// O índice único do banco é quem garante o slug (sem corrida entre checar e gravar).
async function withSlugCheck<T>(slug: string | undefined, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (slug && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new SlugTakenError(slug);
    }
    throw error;
  }
}
