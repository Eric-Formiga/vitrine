import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPerson, startTestApp, type TestApp } from './support/admin-test-kit.js';

describe('US-011 — Árvore pública de categorias', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp();
    const c = t.prisma.category;
    const guia = { columns: ['Tamanho', 'Busto'], rows: [['P', '86'], ['M', '90']] };

    const feminino = await c.create({ data: { name: 'Feminino', slug: 'feminino', position: 1, sizeType: 'CLOTHING' } });
    await c.create({ data: { name: 'Masculino', slug: 'masculino', position: 0, sizeType: 'CLOTHING' } });
    await c.create({ data: { name: 'Saias', slug: 'saias', position: 1, sizeType: 'CLOTHING', parentId: feminino.id } });
    await c.create({ data: { name: 'Vestidos', slug: 'vestidos', position: 0, sizeType: 'CLOTHING', parentId: feminino.id, sizeChart: guia } });
    await c.create({ data: { name: 'Blusas', slug: 'blusas', position: 0, sizeType: 'CLOTHING', parentId: feminino.id } });
    await c.create({
      data: { name: 'Coleção antiga', slug: 'colecao-antiga', position: 0, sizeType: 'ONE_SIZE', archivedAt: new Date() },
    });
  });

  afterAll(async () => {
    await t?.close();
  });

  // Dado: categorias cadastradas em mais de um nível (ex.: Feminino › Vestidos)
  // Quando: qualquer pessoa, logada ou não, pede a árvore (GET /v1/categories)
  // Então: recebe as categorias aninhadas, cada uma com id, nome, slug, tipo de tamanho e guia de medidas
  // E: em cada nível elas vêm na ordem definida pelo admin (posição) e, empatadas, por nome
  // E: categorias arquivadas não aparecem
  it('AC-023: visitante recebe a árvore aninhada e ordenada, sem as arquivadas @spec:AC-023', async () => {
    const res = await request(t.app.getHttpServer()).get('/v1/categories');

    expect(res.status).toBe(200);
    const nomes = (nodes: { name: string; children: unknown[] }[]): unknown =>
      nodes.map((n) => (n.children.length ? { [n.name]: nomes(n.children as never) } : n.name));
    expect(nomes(res.body)).toEqual(['Masculino', { Feminino: ['Blusas', 'Vestidos', 'Saias'] }]);

    const vestidos = res.body[1].children[1];
    expect(vestidos).toEqual({
      id: expect.any(String),
      name: 'Vestidos',
      slug: 'vestidos',
      sizeType: 'CLOTHING',
      sizeChart: { columns: ['Tamanho', 'Busto'], rows: [['P', '86'], ['M', '90']] },
      children: [],
    });
    expect(res.body[0].sizeChart).toBeNull();
  });

  it('AC-023: a árvore também abre para quem está logado @spec:AC-023', async () => {
    const bia = await createPerson(t.prisma, 'Bia');

    const res = await request(t.app.getHttpServer()).get('/v1/categories').set('authorization', bia.auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
