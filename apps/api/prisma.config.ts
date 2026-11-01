import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// A CLI do Prisma (migrate, generate) lê o mesmo .env da raiz que a API.
const rootEnvFile = new URL('../../.env', import.meta.url);
if (!process.env.DATABASE_URL && existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
