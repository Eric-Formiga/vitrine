import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'web',
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    // o site ganha os primeiros testes na T-006
    passWithNoTests: true,
  },
});
