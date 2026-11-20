import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { JOB_QUEUE, type JobQueue } from '../../../shared/queue/job-queue.port.js';
import { STORAGE_GATEWAY, type StorageGateway } from './storage-gateway.port.js';
import { UPLOAD_REPOSITORY, type UploadRepository } from './upload.repository.js';

/** Quanto tempo um arquivo pode ficar sem uso antes de ser apagado. */
export const ORPHAN_AFTER_MS = 24 * 60 * 60 * 1000;
/** Arquivos por chamada de remoção ao Storage. */
export const ORPHAN_BATCH = 100;

export const CLEAN_ORPHAN_UPLOADS_QUEUE = 'media.clean-orphan-uploads';
/** De hora em hora, no minuto 0. */
export const CLEAN_ORPHAN_UPLOADS_CRON = '0 * * * *';

export interface CleanupResult {
  removed: number;
  /** O Storage falhou: esses ficam para a próxima rodada. */
  pending: boolean;
}

// AC-081: apaga do Storage os arquivos enviados e nunca usados, ou tirados de um produto,
// há mais de 24 h. O registro só sai depois que o Storage confirmou: se ele falhar, nada
// se perde, e a próxima rodada tenta de novo.
@Injectable()
export class CleanOrphanUploadsUseCase {
  private readonly logger = new Logger('Limpeza de imagens');

  constructor(
    @Inject(UPLOAD_REPOSITORY) private readonly uploads: UploadRepository,
    @Inject(STORAGE_GATEWAY) private readonly storage: StorageGateway,
  ) {}

  async execute(now = new Date()): Promise<CleanupResult> {
    const cutoff = new Date(now.getTime() - ORPHAN_AFTER_MS);
    let removed = 0;
    for (;;) {
      const batch = await this.uploads.findOrphans(cutoff, ORPHAN_BATCH);
      if (batch.length === 0) return { removed, pending: false };
      try {
        await this.storage.remove(batch);
      } catch (error) {
        this.logger.warn(`o Storage não apagou ${batch.length} arquivos (${(error as Error).message}); ficam para a próxima rodada`);
        return { removed, pending: true };
      }
      await this.uploads.deleteOrphans(batch);
      removed += batch.length;
      if (batch.length < ORPHAN_BATCH) return { removed, pending: false };
    }
  }
}

/** Registra a limpeza na fila, de hora em hora (só onde RUN_WORKER=true, ADR-0010). */
@Injectable()
export class CleanOrphanUploadsJob implements OnModuleInit {
  constructor(
    @Inject(JOB_QUEUE) private readonly queue: JobQueue,
    private readonly cleanup: CleanOrphanUploadsUseCase,
  ) {}

  onModuleInit(): void {
    this.queue.work(CLEAN_ORPHAN_UPLOADS_QUEUE, async () => {
      await this.cleanup.execute();
    });
    this.queue.schedule(CLEAN_ORPHAN_UPLOADS_QUEUE, CLEAN_ORPHAN_UPLOADS_CRON);
  }
}
