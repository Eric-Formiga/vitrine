import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { InvalidEnvError, loadEnv } from './shared/config/env.js';

// Só as filas, sem HTTP: para quando a API e o worker virarem serviços separados (ADR-0010).
// Na demo eles rodam juntos, com RUN_WORKER=true no main.ts.
const rootEnvFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

try {
  const env = loadEnv({ ...process.env, RUN_WORKER: 'true' });
  const app = await NestFactory.createApplicationContext(AppModule.forRoot({ env }), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
} catch (error) {
  if (!(error instanceof InvalidEnvError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
