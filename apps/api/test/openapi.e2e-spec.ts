import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findStaleContractFiles, renderContractFiles } from '../src/scripts/generate-openapi.js';
import { createApp } from '../src/create-app.js';
import { buildOpenApiDocument } from '../src/shared/openapi/openapi.js';

describe('US-014 — Contrato da API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Sem banco: a documentação não depende dele.
    app = await createApp({ env: { ...process.env, RUN_WORKER: 'false' } });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  // Dado: a API rodando
  // Quando: alguém abre /docs
  // Então: vê a documentação interativa (Swagger UI) com as rotas de categorias
  // E: o contrato em JSON (OpenAPI 3) está em /docs/openapi.json, sem exigir login
  it('AC-031: /docs mostra a documentação interativa, sem login @spec:AC-031', async () => {
    const res = await request(app.getHttpServer()).get('/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger-ui');
  });

  it('AC-031: /docs/openapi.json descreve as rotas de categorias com corpos e respostas @spec:AC-031', async () => {
    const res = await request(app.getHttpServer()).get('/docs/openapi.json');

    expect(res.status).toBe(200);
    const doc = res.body;
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBe('Vitrine API');

    const arvore = doc.paths['/v1/categories'].get;
    expect(arvore.responses['200'].content['application/json'].schema).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/PublicCategoryNode' },
    });
    expect(arvore.security).toBeUndefined();

    const criar = doc.paths['/v1/admin/categories'].post;
    expect(criar.requestBody.content['application/json'].schema).toEqual({ $ref: '#/components/schemas/CreateCategory' });
    expect(criar.responses['201'].content['application/json'].schema).toEqual({ $ref: '#/components/schemas/AdminCategory' });
    expect(Object.keys(criar.responses)).toEqual(expect.arrayContaining(['400', '401', '404', '409', '422']));
    expect(criar.security).toEqual([{ clerk: [] }]);

    const patch = doc.paths['/v1/admin/categories/{id}'].patch;
    expect(patch.parameters).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'id', in: 'path' })]));
    expect(doc.paths['/v1/admin/categories/{id}/restore'].post).toBeDefined();
    expect(doc.paths['/v1/admin/categories/{id}'].delete.responses['204']).toBeDefined();

    const { schemas, securitySchemes } = doc.components;
    expect(schemas.CreateCategory.required).toEqual(['name', 'sizeType']);
    expect(schemas.CreateCategory.properties.sizeType.enum).toEqual(['CLOTHING', 'SHOES', 'ONE_SIZE']);
    expect(schemas.PublicCategoryNode.properties.children.items).toEqual({ $ref: '#/components/schemas/PublicCategoryNode' });
    expect(schemas.ProblemDetails.properties).toHaveProperty('errors');
    expect(securitySchemes.clerk).toMatchObject({ type: 'http', scheme: 'bearer' });
    for (const schema of Object.values(schemas)) expect(schema).not.toHaveProperty('$id');
  });

  // Dado: o contrato OpenAPI e os tipos do cliente gerados e guardados no repositório (packages/api-client)
  // Quando: uma rota ou um formato da API muda sem que alguém rode pnpm api:generate
  // Então: um teste falha avisando que o contrato está desatualizado
  it('AC-032: o contrato guardado em packages/api-client está em dia com a API @spec:AC-032', async () => {
    const stale = await findStaleContractFiles(await renderContractFiles(buildOpenApiDocument(app)));

    expect(stale, 'Contrato desatualizado: rode `pnpm api:generate` e faça commit dos arquivos gerados.').toEqual([]);
  });

  it('AC-032: uma mudança na API sem regenerar é detectada @spec:AC-032', async () => {
    const doc = structuredClone(buildOpenApiDocument(app));
    const create = doc.components!.schemas!.CreateCategory as { properties: Record<string, unknown>; required: string[] };
    create.properties.description = { type: 'string' };
    create.required.push('description');

    const stale = await findStaleContractFiles(await renderContractFiles(doc));

    expect(stale).toEqual(['openapi.json', 'src/schema.d.ts']);
  });
});
