import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../shared/prisma/prisma.service.js';
import type { AsaasEventRepository } from '../application/asaas-event.repository.js';

@Injectable()
export class PrismaAsaasEventRepository implements AsaasEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async register({ id, type }: { id: string; type: string }): Promise<{ alreadyProcessed: boolean }> {
    // INSERT ... ON CONFLICT (id) DO NOTHING: dois reenvios simultâneos não duplicam a linha.
    await this.prisma.asaasEvent.createMany({ data: [{ id, type }], skipDuplicates: true });
    const stored = await this.prisma.asaasEvent.findUniqueOrThrow({ where: { id }, select: { processedAt: true } });
    return { alreadyProcessed: stored.processedAt !== null };
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.asaasEvent.update({ where: { id: eventId }, data: { processedAt: new Date() } });
  }
}
