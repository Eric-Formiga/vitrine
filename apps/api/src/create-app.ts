import 'reflect-metadata';

import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import type { DestinationStream } from 'pino';

import { AppModule } from './app.module.js';
import type { ClerkGateway } from './modules/identity/application/clerk-gateway.port.js';
import { loadEnv } from './shared/config/env.js';
import { setupOpenApi } from './shared/openapi/openapi.js';

export interface CreateAppOptions {
  /** Variáveis de ambiente; padrão: process.env. */
  env?: Record<string, string | undefined>;
  /** Destino dos logs; padrão: saída padrão. Os testes passam um coletor. */
  logStream?: DestinationStream;
  /** Módulos extras, usados pelos testes. */
  imports?: ModuleMetadata['imports'];
  /** Substitui a API do Clerk (usado pelos testes). */
  clerkGateway?: ClerkGateway;
}

// Monta a aplicação com a mesma configuração no servidor (main.ts) e nos testes.
export async function createApp(options: CreateAppOptions = {}): Promise<INestApplication> {
  // Falha antes de montar qualquer coisa se a configuração estiver errada (AC-015).
  const env = loadEnv(options.env ?? process.env);

  const app = await NestFactory.create(
    AppModule.forRoot({
      env,
      logStream: options.logStream,
      imports: options.imports,
      clerkGateway: options.clerkGateway,
    }),
    // rawBody: o webhook do Clerk confere a assinatura sobre o corpo exatamente como chegou.
    { bufferLogs: true, rawBody: true },
  );
  app.useLogger(app.get(Logger));

  // Health checks ficam fora da versão; o resto da API, sob /v1 (ASM-003).
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });
  app.enableShutdownHooks();
  // Contrato e documentação interativa em /docs (ADR-0008, AC-031).
  setupOpenApi(app);

  return app;
}
