import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC no lugar do esbuild: o Nest precisa dos metadados dos decorators.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Ambiente dos testes: válido e silencioso. Cada teste pode sobrescrever via createApp({ env }).
    // O banco padrão não existe de propósito; quem precisa de banco sobe um com Testcontainers.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://vitrine:vitrine@127.0.0.1:1/vitrine',
      // mesmo segredo de teste do test/support/clerk-test-kit.ts
      CLERK_WEBHOOK_SECRET: 'whsec_' + Buffer.from('segredo-de-teste-da-vitrine!').toString('base64'),
    },
    // Subir o Postgres em Docker leva alguns segundos (mais na primeira vez, que baixa a imagem).
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
});
