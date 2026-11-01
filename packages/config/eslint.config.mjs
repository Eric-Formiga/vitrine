import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Base compartilhada; cada app roda `eslint --config` apontando para este arquivo.
export default [
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**', '**/next-env.d.ts', '**/src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
