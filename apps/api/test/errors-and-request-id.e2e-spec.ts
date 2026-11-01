import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/create-app.js';
import { Public } from '../src/shared/auth/public.decorator.js';
import { DomainError } from '../src/shared/errors/domain-error.js';

class ProdutoEsgotadoError extends DomainError {
  readonly code = 'OUT_OF_STOCK';
  override readonly status = 409;
}

// Rotas só de teste: uma falha inesperada e um erro de domínio.
@Public()
@Controller('teste')
class FalhasController {
  @Get('falha')
  falha(): never {
    throw new Error('boom: detalhe interno que não pode vazar');
  }

  @Get('dominio')
  dominio(): never {
    throw new ProdutoEsgotadoError('O tamanho M acabou.');
  }
}

@Module({ controllers: [FalhasController] })
class FalhasModule {}

// Ambiente padrão dos testes (vitest.config.ts), com log ligado para conferir o requestId.
const ENV = { ...process.env, LOG_LEVEL: 'info' };

describe('US-006 — Erros previsíveis e cada requisição rastreável', () => {
  let app: INestApplication;
  const logs: string[] = [];

  beforeAll(async () => {
    app = await createApp({
      env: ENV,
      imports: [FalhasModule],
      logStream: { write: (line: string) => void logs.push(line) },
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    logs.length = 0;
  });

  // Dado: uma rota que não existe, ou uma falha inesperada dentro da API
  // Quando: a API responde com erro
  // Então: a resposta vem como application/problem+json com type, title, status e detail
  it('AC-013: rota inexistente responde no formato padrão de erro @spec:AC-013', async () => {
    const res = await request(app.getHttpServer()).get('/v1/rota-que-nao-existe');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      instance: '/v1/rota-que-nao-existe',
    });
    expect(res.body.detail).toEqual(expect.any(String));
  });

  // E: a falha inesperada vira 500 sem mostrar a pilha de erro para quem chamou
  it('AC-013: falha inesperada vira 500 sem vazar detalhes internos @spec:AC-013', async () => {
    const res = await request(app.getHttpServer()).get('/v1/teste/falha');

    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({ type: 'about:blank', title: 'Internal Server Error', status: 500 });
    expect(res.text).not.toContain('boom');
    expect(res.text).not.toMatch(/at .+\.(ts|js):\d+/);
  });

  it('erro de domínio vira problem+json com tipo e código próprios', async () => {
    const res = await request(app.getHttpServer()).get('/v1/teste/dominio');

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      type: '/problems/out-of-stock',
      title: 'Conflict',
      status: 409,
      detail: 'O tamanho M acabou.',
      code: 'OUT_OF_STOCK',
    });
  });

  // Dado: uma requisição qualquer à API
  // Quando: a resposta volta
  // Então: ela traz o cabeçalho x-request-id
  // E: o log daquela requisição (JSON, pino) tem o mesmo requestId
  it('AC-014: resposta e log da requisição levam o mesmo identificador @spec:AC-014', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');

    const requestId = res.headers['x-request-id'];
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    const entries = logs.map((line) => JSON.parse(line) as Record<string, unknown>);
    const doRequest = entries.filter((entry) => entry.requestId === requestId);
    expect(doRequest.length).toBeGreaterThan(0);
  });

  it('erros também carregam o requestId no corpo, para o suporte achar o log', async () => {
    const res = await request(app.getHttpServer()).get('/v1/rota-que-nao-existe');

    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('reaproveita um x-request-id seguro vindo do cliente e ignora um inseguro', async () => {
    const seguro = await request(app.getHttpServer()).get('/health/live').set('x-request-id', 'web-abc.123');
    expect(seguro.headers['x-request-id']).toBe('web-abc.123');

    const inseguro = await request(app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', 'id falso {"level":60}');
    expect(inseguro.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('o log da requisição não guarda cabeçalhos (token e cookie ficam de fora)', async () => {
    await request(app.getHttpServer()).get('/health/live').set('authorization', 'Bearer token-secreto');

    expect(logs.join('\n')).not.toContain('token-secreto');
  });
});
