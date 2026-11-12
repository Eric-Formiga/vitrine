import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NextConfig } from 'next';

// O site lê o mesmo .env da raiz do monorepo que a API (o Next roda com cwd em apps/web).
const rootEnvFile = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O cliente tipado da API é publicado como TypeScript; o Next compila junto com o site.
  transpilePackages: ['@vitrine/api-client'],
};

export default nextConfig;
