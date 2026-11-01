import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { UserRepository } from '../application/user.repository.js';
import { anonymizedIdentity, type ClerkProfile, DEFAULT_ROLES, type User } from '../domain/user.js';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByClerkId(clerkId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, clerkId: true, email: true, name: true, roles: true, deletedAt: true },
    });
  }

  async upsertProfile({ clerkId, email, name, phone }: ClerkProfile): Promise<void> {
    await this.prisma.user.upsert({
      where: { clerkId },
      create: { clerkId, email, name, phone, roles: [...DEFAULT_ROLES] },
      update: { email, name, phone },
    });
  }

  async anonymize(clerkId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { clerkId, deletedAt: null },
      data: { ...anonymizedIdentity(clerkId), deletedAt: new Date() },
    });
  }
}
