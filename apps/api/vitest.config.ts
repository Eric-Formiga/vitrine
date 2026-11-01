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
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://vitrine:vitrine@localhost:5432/vitrine_test',
    },
  },
});
