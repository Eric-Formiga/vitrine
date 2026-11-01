import { Global, Module } from '@nestjs/common';

import { JOB_QUEUE } from './job-queue.port.js';
import { PgBossJobQueue } from './pg-boss.job-queue.js';

@Global()
@Module({
  providers: [{ provide: JOB_QUEUE, useClass: PgBossJobQueue }],
  exports: [JOB_QUEUE],
})
export class QueueModule {}
