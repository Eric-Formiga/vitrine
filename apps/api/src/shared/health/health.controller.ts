import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../auth/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JOB_QUEUE, type JobQueue } from '../queue/job-queue.port.js';

type Check = 'up' | 'down';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  // "Viva": responde enquanto o processo estiver de pé, sem depender do banco.
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  // "Pronta": só quando o banco responde e as filas estão iniciadas (AC-012).
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: 'ok' | 'unavailable'; checks: { database: Check; queues: Check } }> {
    const database: Check = (await this.prisma.isReachable()) ? 'up' : 'down';
    const queues: Check = this.jobQueue.isReady() ? 'up' : 'down';
    const ok = database === 'up' && queues === 'up';

    res.status(ok ? 200 : 503);
    return { status: ok ? 'ok' : 'unavailable', checks: { database, queues } };
  }
}
