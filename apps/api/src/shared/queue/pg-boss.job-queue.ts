import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PgBoss } from 'pg-boss';

import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import type { JobQueue } from './job-queue.port.js';

const RETRY_START_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 30_000;

// Filas no próprio Postgres, schema `pgboss` (ADR-0009), com pool pequeno para o plano gratuito.
@Injectable()
export class PgBossJobQueue implements JobQueue, OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger('Filas');
  private readonly boss: PgBoss;
  private readonly handlers = new Map<string, (data: unknown) => Promise<void>>();
  private readonly createdQueues = new Set<string>();
  private started = false;
  private retryTimer?: NodeJS.Timeout;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly adapterHost: HttpAdapterHost,
  ) {
    this.boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss', max: 3 });
    this.boss.on('error', (error) => this.logger.error(error.message));
  }

  work<T = unknown>(queue: string, handler: (data: T) => Promise<void>): void {
    this.handlers.set(queue, handler as (data: unknown) => Promise<void>);
  }

  async send(queue: string, data: object): Promise<string | null> {
    await this.ensureQueue(queue);
    return this.boss.send(queue, data);
  }

  isReady(): boolean {
    return this.started;
  }

  // Não bloqueia a subida: com o banco fora do ar, a API sobe e tenta de novo depois.
  async onApplicationBootstrap(): Promise<void> {
    await this.tryStart();
  }

  private async tryStart(): Promise<void> {
    try {
      await this.boss.start();
      this.started = true;
      for (const queue of this.handlers.keys()) await this.ensureQueue(queue);
      if (this.env.RUN_WORKER) await this.startConsumers();
    } catch (error) {
      this.logger.warn(`filas indisponíveis (${(error as Error).message}); nova tentativa em ${RETRY_START_MS / 1000} s`);
      this.retryTimer = setTimeout(() => void this.tryStart(), RETRY_START_MS);
      this.retryTimer.unref();
    }
  }

  private async startConsumers(): Promise<void> {
    for (const [queue, handler] of this.handlers) {
      await this.boss.work(queue, async (jobs) => {
        for (const job of jobs) await handler(job.data);
      });
    }
  }

  private async ensureQueue(queue: string): Promise<void> {
    if (this.createdQueues.has(queue)) return;
    await this.boss.createQueue(queue);
    this.createdQueues.add(queue);
  }

  // SIGTERM (ADR-0010): 1) para de aceitar requisições novas; 2) espera os jobs em
  // andamento terminarem (até 30 s); 3) só então o Nest segue encerrando o resto.
  async beforeApplicationShutdown(): Promise<void> {
    clearTimeout(this.retryTimer);

    const server = this.adapterHost.httpAdapter?.getHttpServer() as { listening?: boolean; close?: () => void } | undefined;
    if (server?.listening) server.close?.();

    if (this.started) {
      await this.boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
      this.started = false;
    }
  }
}
