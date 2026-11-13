import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { inject } from 'vitest';

import { databaseUrl, TEMPLATE_DATABASE } from './global-postgres.js';

export interface TestDatabase {
  url: string;
  stop: () => Promise<void>;
}

// Banco descartável para um arquivo de teste (ASM-002): uma cópia do banco-modelo,
// já migrado, no Postgres compartilhado da rodada (global-postgres.ts). Copiar leva
// milissegundos, e cada arquivo continua isolado: um não vê os dados do outro.
export async function startTestDatabase(): Promise<TestDatabase> {
  const adminUrl = inject('postgresAdminUrl');
  const name = `teste_${randomUUID().replaceAll('-', '')}`;

  await withAdmin(adminUrl, (admin) => createFromTemplate(admin, name));

  return {
    url: databaseUrl(adminUrl, name),
    // FORCE derruba conexões que ficaram abertas (ex.: pool das filas).
    stop: async () => {
      await withAdmin(adminUrl, (admin) => admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
    },
  };
}

async function withAdmin<T>(adminUrl: string, fn: (admin: Client) => Promise<T>): Promise<T> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

// Duas cópias pedidas no mesmo instante podem esbarrar uma na outra no modelo
// ("source database is being accessed by other users", 55006): tenta de novo.
async function createFromTemplate(admin: Client, name: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await admin.query(`CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DATABASE}"`);
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== '55006' || attempt >= 20) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
}

// Endereço de um Postgres que não existe: para os cenários de banco fora do ar.
export const UNREACHABLE_DATABASE_URL = 'postgresql://vitrine:vitrine@127.0.0.1:1/vitrine';
