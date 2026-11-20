import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { NewUpload, UploadRepository } from '../application/upload.repository.js';

/** Sem foto de produto usando o arquivo: a chave estrangeira impediria apagar o registro. */
const UNUSED = { images: { none: {} } } satisfies Prisma.UploadWhereInput;

@Injectable()
export class PrismaUploadRepository implements UploadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(upload: NewUpload): Promise<void> {
    await this.prisma.upload.create({ data: upload });
  }

  async findOrphans(cutoff: Date, limit: number): Promise<string[]> {
    const rows = await this.prisma.upload.findMany({
      where: {
        ...UNUSED,
        OR: [{ detachedAt: null, createdAt: { lt: cutoff } }, { detachedAt: { lt: cutoff } }],
      },
      select: { path: true },
      orderBy: [{ createdAt: 'asc' }, { path: 'asc' }],
      take: limit,
    });
    return rows.map((row) => row.path);
  }

  async deleteOrphans(paths: readonly string[]): Promise<void> {
    await this.prisma.upload.deleteMany({ where: { ...UNUSED, path: { in: [...paths] } } });
  }
}
