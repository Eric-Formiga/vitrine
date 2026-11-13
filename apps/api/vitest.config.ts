import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC no lugar do esbuild: o Nest precisa dos metadados dos decorators.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Um Postgres só para a rodada; cada arquivo ganha uma cópia do banco-modelo.
    globalSetup: ['test/support/global-postgres.ts'],
    // Ambiente dos testes: válido e silencioso. Cada teste pode sobrescrever via createApp({ env }).
    // O banco padrão não existe de propósito; quem precisa de banco pede uma cópia com startTestDatabase().
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://vitrine:vitrine@127.0.0.1:1/vitrine',
      // mesmo segredo de teste do test/support/clerk-test-kit.ts
      CLERK_WEBHOOK_SECRET: 'whsec_' + Buffer.from('segredo-de-teste-da-vitrine!').toString('base64'),
      // Marcadores: os testes de login passam a chave pública do kit em createApp({ env })
      CLERK_JWT_KEY: 'chave-publica-de-teste',
      CLERK_SECRET_KEY: 'sk_' + 'test_' + 'marcador',
      CLERK_AUTHORIZED_PARTIES: 'http://localhost:3000',
    },
    // Subir o Postgres em Docker leva alguns segundos (mais na primeira vez, que baixa a imagem).
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
});
