import { Inject, Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';
import { AuditTrail } from '../../../shared/audit/audit-trail.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import { UserRolesService } from '../../identity/application/user-roles.service.js';
import { DOCUMENT_VAULT, type DocumentVault } from '../application/document-vault.port.js';
import type {
  SellerApplicationData,
  SellerChanges,
  SellerRepository,
  SellerWithOwner,
  SellerWriteSession,
} from '../application/seller.repository.js';
import type { Seller, SellerStatus } from '../domain/seller.js';
import { DocumentTakenError, SellerApplicationExistsError, SellerSlugTakenError } from '../domain/seller-errors.js';

type Row = Prisma.SellerGetPayload<object>;

const WITH_OWNER = { user: { select: { id: true, name: true, email: true } } } as const;
type RowWithOwner = Prisma.SellerGetPayload<{ include: typeof WITH_OWNER }>;

@Injectable()
export class PrismaSellerRepository implements SellerRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCUMENT_VAULT) private readonly vault: DocumentVault,
    private readonly trail: AuditTrail,
    private readonly userRoles: UserRolesService,
  ) {}

  async listByStatus(status: SellerStatus): Promise<SellerWithOwner[]> {
    const rows = await this.prisma.seller.findMany({
      where: { status },
      include: WITH_OWNER,
      orderBy: [{ appliedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toSellerWithOwner(row));
  }

  write<T>(work: (session: SellerWriteSession) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(this.session(tx)));
  }

  private session(tx: Prisma.TransactionClient): SellerWriteSession {
    return {
      lockById: async (id: string) => {
        await tx.$executeRaw`SELECT 1 FROM sellers WHERE id = ${id}::uuid FOR UPDATE`;
        const row = await tx.seller.findUnique({ where: { id }, include: WITH_OWNER });
        return row ? this.toSellerWithOwner(row) : null;
      },
      update: async (id: string, changes: SellerChanges) =>
        this.toSellerWithOwner(await tx.seller.update({ where: { id }, data: changes, include: WITH_OWNER })),
      grantRole: (userId, role) => this.userRoles.grant(tx, userId, role),
      audit: (entityId: string, before: unknown, after: unknown) =>
        this.trail.record(tx, { entityType: 'seller', entityId, before, after }),
    };
  }

  private toSellerWithOwner({ user, ...row }: RowWithOwner): SellerWithOwner {
    return { ...this.toSeller(row), owner: user };
  }

  async findByUserId(userId: string): Promise<Seller | null> {
    const row = await this.prisma.seller.findUnique({ where: { userId } });
    return row ? this.toSeller(row) : null;
  }

  async isActiveCategory(categoryId: string): Promise<boolean> {
    const found = await this.prisma.category.findFirst({ where: { id: categoryId, archivedAt: null }, select: { id: true } });
    return found !== null;
  }

  async findConflicts({ slug, documentHash, exceptUserId }: { slug: string; documentHash: string; exceptUserId: string }) {
    const others = await this.prisma.seller.findMany({
      where: { userId: { not: exceptUserId }, OR: [{ slug }, { documentHash }] },
      select: { slug: true, documentHash: true },
    });
    return {
      slugTaken: others.some((other) => other.slug === slug),
      documentTaken: others.some((other) => other.documentHash === documentHash),
    };
  }

  async createApplication(data: SellerApplicationData): Promise<Seller> {
    return this.toSeller(await withUniqueChecks(data.slug, () => this.prisma.seller.create({ data: this.columns(data) })));
  }

  async reapply(sellerId: string, data: SellerApplicationData): Promise<Seller> {
    const row = await withUniqueChecks(data.slug, () =>
      this.prisma.seller.update({
        where: { id: sellerId },
        data: {
          ...this.columns(data),
          status: 'PENDING',
          appliedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
        },
      }),
    );
    return this.toSeller(row);
  }

  // A tabela de frete chega na T-018; até lá, nenhuma loja tem frete configurado.
  hasShipping(): Promise<boolean> {
    return Promise.resolve(false);
  }

  private columns(data: SellerApplicationData) {
    const sealed = this.vault.seal(data.document);
    return {
      userId: data.userId,
      storeName: data.storeName,
      slug: data.slug,
      bio: data.bio,
      instagram: data.instagram,
      mainCategoryId: data.mainCategoryId,
      documentEncrypted: sealed.encrypted,
      documentHash: sealed.hash,
      pixKeyType: data.pixKey.type,
      pixKey: data.pixKey.key,
      pixKeyOwnerName: data.pixKey.ownerName,
      pixKeyOwnerDocument: data.pixKey.ownerDocument,
      pixKeyVerifiedAt: data.pixKey.verifiedAt,
    };
  }

  private toSeller(row: Row): Seller {
    return {
      id: row.id,
      userId: row.userId,
      storeName: row.storeName,
      slug: row.slug,
      bio: row.bio,
      instagram: row.instagram,
      mainCategoryId: row.mainCategoryId,
      document: this.vault.open(row.documentEncrypted),
      status: row.status,
      pixKey: {
        type: row.pixKeyType,
        key: row.pixKey,
        ownerName: row.pixKeyOwnerName,
        ownerDocument: row.pixKeyOwnerDocument,
        verifiedAt: row.pixKeyVerifiedAt,
      },
      commissionBps: row.commissionBps,
      appliedAt: row.appliedAt,
      approvedAt: row.approvedAt,
      rejectedAt: row.rejectedAt,
      rejectionReason: row.rejectionReason,
      suspendedAt: row.suspendedAt,
      suspensionReason: row.suspensionReason,
    };
  }
}

/**
 * Os índices únicos (conta, slug, documento) são a última palavra: duas candidaturas
 * simultâneas passam pela checagem prévia, mas só uma grava. Traduz o P2002 pelo índice.
 */
async function withUniqueChecks<T>(slug: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = JSON.stringify(error.meta ?? {});
      if (target.includes('document_hash') || target.includes('documentHash')) throw new DocumentTakenError();
      if (target.includes('slug')) throw new SellerSlugTakenError(slug);
      if (target.includes('user_id') || target.includes('userId')) throw new SellerApplicationExistsError();
    }
    throw error;
  }
}
