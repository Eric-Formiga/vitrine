import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

const apiDir = fileURLToPath(new URL('../..', import.meta.url));

export interface TestDatabase {
  url: string;
  stop: () => Promise<void>;
}

// Sobe um Postgres descartável em Docker (ASM-002) e aplica as migrações do Prisma.
export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:17-alpine').start();
  const url = container.getConnectionUri();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });

  return { url, stop: async () => void (await container.stop()) };
}

// Endereço de um Postgres que não existe: para os cenários de banco fora do ar.
export const UNREACHABLE_DATABASE_URL = 'postgresql://vitrine:vitrine@127.0.0.1:1/vitrine';
