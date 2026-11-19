import type { Server } from 'node:http';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import { createCategory, createStore, insertImage, productOf, type TestStore, variantOf } from './support/product-test-kit.js';
import { FakeStorage } from './support/storage-test-kit.js';

describe('US-026 — O vendedor publica o produto', () => {
  let t: TestApp;
  let ana: TestStore;
  let vestidos: string;
  const storage = new FakeStorage();
  const http = () => request(t.app.getHttpServer());

  const criar = async (loja: TestPerson) => {
    const res = await http().post('/v1/seller/products').set('authorization', loja.auth).send(productOf(vestidos));
    return res.body.id as string;
  };
  const gravarGrade = (id: string, variants: object[], ifMatch: string) =>
    http().put(`/v1/seller/products/${id}/variants`).set('authorization', ana.auth).set('if-match', ifMatch).send({ variants });
  const gravarFotos = (id: string, images: object[], ifMatch: string) =>
    http().put(`/v1/seller/products/${id}/images`).set('authorization', ana.auth).set('if-match', ifMatch).send({ images });
  const publicar = (id: string, ifMatch?: string) => {
    const req = http().post(`/v1/seller/products/${id}/publish`).set('authorization', ana.auth);
    return ifMatch === undefined ? req : req.set('if-match', ifMatch);
  };
  const abrir = (id: string) => http().get(`/v1/seller/products/${id}`).set('authorization', ana.auth);
  /** Rascunho com foto e uma variante com estoque: versão 2. */
  const rascunhoCompleto = async () => {
    const id = await criar(ana);
    await insertImage(t.prisma, ana, id);
    expect((await gravarGrade(id, [variantOf('M', 'Preto', { stock: 3 })], '"1"')).status).toBe(200);
    return id;
  };

  beforeAll(async () => {
    t = await startTestApp([], { storageGateway: storage });
    await new Promise<void>((resolve) => (t.app.getHttpServer() as Server).listen(0, resolve));
    vestidos = await createCategory(t.prisma, 'vestidos');
    ana = await createStore(t, 'Ana', vestidos);
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.productImage.deleteMany();
    await t.prisma.upload.deleteMany();
    await t.prisma.productVariant.deleteMany();
    await t.prisma.product.deleteMany();
    storage.reset();
  });

  // Dado: um rascunho com pelo menos uma imagem e uma variante com estoque, de uma loja aprovada
  // Quando: o vendedor publica (POST /v1/seller/products/{id}/publish)
  // Então: o produto passa a ativo (ACTIVE), com a data de publicação
  it('AC-071: publicar o produto completo @spec:AC-071 @spec:US-026', async () => {
    const id = await rascunhoCompleto();

    const res = await publicar(id, '"2"');

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.headers.etag).toBe('"3"');
    expect(res.body).toMatchObject({ status: 'ACTIVE', version: 3, publishedAt: expect.any(String) });
    expect((await abrir(id)).body).toMatchObject({ status: 'ACTIVE', publishedAt: res.body.publishedAt });

    // Publicar exige a versão certa, como as outras escritas (AC-075).
    const outro = await rascunhoCompleto();
    expect((await publicar(outro)).status).toBe(428);
    const atrasado = await publicar(outro, '"1"');
    expect([atrasado.status, atrasado.body.code, atrasado.body.currentVersion]).toEqual([412, 'PRODUCT_VERSION_CONFLICT', 2]);
    expect((await abrir(outro)).body.status).toBe('DRAFT');
    // Já ativo, não se publica de novo.
    const deNovo = await publicar(id, '"3"');
    expect([deNovo.status, deNovo.body.code, deNovo.body.currentStatus]).toEqual([422, 'INVALID_STATE_TRANSITION', 'ACTIVE']);
  });

  // Dado: um rascunho sem imagem, ou sem variante com estoque
  // Quando: o vendedor tenta publicar
  // Então: 422 PRODUCT_NOT_PUBLISHABLE, com a lista do que falta (images, stock)
  // E: o produto continua rascunho
  it('AC-072: produto incompleto não é publicado @spec:AC-072', async () => {
    const vazio = await criar(ana);
    const semFoto = await criar(ana);
    await gravarGrade(semFoto, [variantOf('M', 'Preto', { stock: 2 })], '"1"');
    const semEstoque = await criar(ana);
    await insertImage(t.prisma, ana, semEstoque);
    await gravarGrade(semEstoque, [variantOf('M', 'Preto', { stock: 0 }), variantOf('G', 'Preto', { stock: 0 })], '"1"');

    const casos: [string, string, string[]][] = [
      [vazio, '"1"', ['images', 'stock']],
      [semFoto, '"2"', ['images']],
      [semEstoque, '"2"', ['stock']],
    ];
    for (const [id, versao, falta] of casos) {
      const res = await publicar(id, versao);
      expect([res.status, res.body.code, res.body.missing], falta.join()).toEqual([422, 'PRODUCT_NOT_PUBLISHABLE', falta]);
      expect((await abrir(id)).body).toMatchObject({ status: 'DRAFT', version: Number(versao.replaceAll('"', '')), publishedAt: null });
    }

    // Variante arquivada com estoque não conta.
    await gravarGrade(semFoto, [variantOf('G', 'Preto', { stock: 0 })], '"2"');
    await insertImage(t.prisma, ana, semFoto);
    const soArquivadaComEstoque = await publicar(semFoto, '"3"');
    expect(soArquivadaComEstoque.body.missing).toEqual(['stock']);
  });

  // Dado: um produto ativo
  // Quando: o vendedor salva uma lista vazia de imagens ou uma grade vazia
  // Então: 422 PRODUCT_NOT_PUBLISHABLE, e o produto não muda
  // E: zerar o estoque de todas as variantes é permitido: o produto fica ativo, mas esgotado
  it('AC-073: o produto ativo continua completo @spec:AC-073', async () => {
    const id = await rascunhoCompleto();
    await publicar(id, '"2"');

    const semGrade = await gravarGrade(id, [], '"3"');
    const semFotos = await gravarFotos(id, [], '"3"');

    expect([semGrade.status, semGrade.body.code, semGrade.body.missing]).toEqual([422, 'PRODUCT_NOT_PUBLISHABLE', ['variants']]);
    expect([semFotos.status, semFotos.body.code, semFotos.body.missing]).toEqual([422, 'PRODUCT_NOT_PUBLISHABLE', ['images']]);
    expect((await abrir(id)).body).toMatchObject({ status: 'ACTIVE', version: 3 });
    expect(await t.prisma.productVariant.count({ where: { productId: id, archivedAt: null } })).toBe(1);
    expect(await t.prisma.productImage.count({ where: { productId: id } })).toBe(1);

    // Esgotado pode: pela grade e pelo ajuste rápido.
    const zerada = await gravarGrade(id, [variantOf('M', 'Preto', { stock: 0 }), variantOf('G', 'Preto', { stock: 1 })], '"3"');
    expect(zerada.status, JSON.stringify(zerada.body)).toBe(200);
    const g = (zerada.body.variants as { id: string; size: string }[]).find((v) => v.size === 'G');
    const ajuste = await http().patch(`/v1/seller/variants/${g?.id}/stock`).set('authorization', ana.auth).send({ delta: -1 });
    expect(ajuste.body.stock).toBe(0);
    expect((await abrir(id)).body.status).toBe('ACTIVE');

    // O rascunho pode ficar vazio enquanto é montado.
    const rascunho = await rascunhoCompleto();
    expect((await gravarGrade(rascunho, [], '"2"')).status).toBe(200);
  });
});
