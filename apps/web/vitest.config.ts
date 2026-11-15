import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O mesmo atalho `@/` do tsconfig, para os testes renderizarem componentes que usam os outros.
  resolve: { alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./', import.meta.url)) }] },
  test: {
    name: 'web',
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    // O @clerk/nextjs é publicado para rodar dentro de um bundler; o Vite processa ele nos testes.
    server: { deps: { inline: [/@clerk\//] } },
  },
});
