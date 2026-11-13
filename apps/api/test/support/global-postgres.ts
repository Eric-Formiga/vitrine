import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';

// Um Postgres só para a rodada inteira de testes (globalSetup do Vitest).
// Sobe o container uma vez e aplica as migrações uma vez num banco-modelo; cada
// arquivo de teste depois ganha uma cópia própria dele (ver postgres-container.ts).
// Antes, cada arquivo subia o próprio container e rodava as migrações: 9 de uma vez
// no Docker do Windows deixavam a suíte em ~3 min.

export const TEMPLATE_DATABASE = 'vitrine_modelo';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Conexão com o banco de administração do Postgres compartilhado (cria e apaga as cópias). */
    postgresAdminUrl: string;
  }
}

const apiDir = fileURLToPath(new URL('../..', import.meta.url));
const prismaCli = fileURLToPath(new URL('../../node_modules/prisma/build/index.js', import.meta.url));

export function databaseUrl(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const adminUrl = databaseUrl(container.getConnectionUri(), 'postgres');

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${TEMPLATE_DATABASE}"`);
  await admin.end();

  // node direto no CLI do Prisma: sem o pnpm no meio e sem shell.
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL: databaseUrl(adminUrl, TEMPLATE_DATABASE) },
    stdio: 'pipe',
  });

  project.provide('postgresAdminUrl', adminUrl);
  return async () => void (await container.stop());
}
