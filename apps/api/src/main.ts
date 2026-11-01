import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createApp } from './create-app.js';
import { ENV } from './shared/config/config.module.js';
import { type Env, InvalidEnvError } from './shared/config/env.js';

// Em desenvolvimento, lê o .env da raiz do monorepo (dist/main.js → ../../../.env).
const rootEnvFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

try {
  const app = await createApp();
  const { PORT } = app.get<Env>(ENV);
  await app.listen(PORT);
} catch (error) {
  if (!(error instanceof InvalidEnvError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
