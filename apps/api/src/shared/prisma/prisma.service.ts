import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

// Conexão preguiçosa: a API sobe mesmo com o banco fora do ar (AC-011).
@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 2_000 }) });
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // Fecha por último, depois de as filas terminarem os jobs que usam o banco.
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
