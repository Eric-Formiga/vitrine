import { defineConfig } from 'vitest/config';

// Um único `pnpm vitest run` na raiz roda os testes de todos os apps (ASM-001).
export default defineConfig({
  test: {
    projects: ['apps/*'],
  },
});
