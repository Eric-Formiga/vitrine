import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'web',
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    // O @clerk/nextjs é publicado para rodar dentro de um bundler; o Vite processa ele nos testes.
    server: { deps: { inline: [/@clerk\//] } },
  },
});
