import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/create-app.js';

describe('US-005 — Dá para saber se a API está de pé', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Dado: a API rodando, mesmo que o banco esteja fora do ar
  // Quando: alguém consulta GET /health/live
  // Então: a resposta é 200
  it('AC-011: "Viva" responde 200 @spec:AC-011', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('health fica fora do prefixo de versão (ASM-003)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health/live');

    expect(res.status).toBe(404);
  });
});
