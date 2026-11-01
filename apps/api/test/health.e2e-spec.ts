import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/create-app.js';
import { startTestDatabase, type TestDatabase, UNREACHABLE_DATABASE_URL } from './support/postgres-container.js';

describe('US-005 — Dá para saber se a API está de pé (banco fora do ar)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp({ env: { ...process.env, DATABASE_URL: UNREACHABLE_DATABASE_URL } });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Dado: a API rodando, mesmo que o banco esteja fora do ar
  // Quando: alguém consulta GET /health/live
  // Então: a resposta é 200
  it('AC-011: "Viva" responde 200 mesmo com o banco fora do ar @spec:AC-011', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  // E: a resposta é 503 se o Postgres estiver fora do ar
  it('AC-012: "Pronta" responde 503 com o banco fora do ar @spec:AC-012', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', checks: { database: 'down', queues: 'down' } });
  });

  it('health fica fora do prefixo de versão (ASM-003)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health/live');

    expect(res.status).toBe(404);
  });
});

describe('US-005 — Dá para saber se a API está de pé (banco e filas funcionando)', () => {
  let db: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    db = await startTestDatabase();
    app = await createApp({ env: { ...process.env, DATABASE_URL: db.url } });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  // Dado: a API rodando
  // Quando: alguém consulta GET /health/ready
  // Então: a resposta é 200 se o Postgres responde e as filas (pg-boss) estão iniciadas
  it('AC-012: "Pronta" responde 200 com banco e filas funcionando @spec:AC-012', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up', queues: 'up' } });
  });

  it('AC-011: "Viva" continua respondendo 200 com o banco no ar @spec:AC-011', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');

    expect(res.status).toBe(200);
  });
});
