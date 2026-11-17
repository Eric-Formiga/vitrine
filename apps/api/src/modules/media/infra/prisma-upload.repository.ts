import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { NewUpload, UploadRepository } from '../application/upload.repository.js';

@Injectable()
export class PrismaUploadRepository implements UploadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(upload: NewUpload): Promise<void> {
    await this.prisma.upload.create({ data: upload });
  }
}
