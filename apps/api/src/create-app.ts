import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

// Monta a aplicação com a mesma configuração no servidor (main.ts) e nos testes.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  // Health checks ficam fora da versão; o resto da API, sob /v1 (ASM-003).
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });
  app.enableShutdownHooks();

  return app;
}
