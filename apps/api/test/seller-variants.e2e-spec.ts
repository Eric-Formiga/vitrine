import type { Server } from 'node:http';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import { createCategory, createStore, productOf, type TestStore, variantOf } from './support/product-test-kit.js';

interface SellerVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  priceCents: number;
  stock: number;
}

describe('US-024 e US-028 — O vendedor monta a grade de variantes e ajusta o estoque', () => {
  let t: TestApp;
  let ana: TestStore;
  let bruno: TestStore;
  let vestidos: string;
  let tenis: string;
  let bolsas: string;
  const http = () => request(t.app.getHttpServer());

  const criar = async (loja: TestPerson, extra: Record<string, unknown> = {}) => {
    const res = await http().post('/v1/seller/products').set('authorization', loja.auth).send(productOf(vestidos, extra));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body as { id: string; slug: string };
  };
  const gravarGrade = (loja: TestPerson, id: string, variants: object[], ifMatch?: string) => {
    const req = http().put(`/v1/seller/products/${id}/variants`).set('authorization', loja.auth);
    return (ifMatch === undefined ? req : req.set('if-match', ifMatch)).send({ variants });
  };
  const lerGrade = (loja: TestPerson, id: string) => http().get(`/v1/seller/products/${id}/variants`).set('authorization', loja.auth);
  const abrir = (loja: TestPerson, id: string) => http().get(`/v1/seller/products/${id}`).set('authorization', loja.auth);
  const ajustar = (loja: TestPerson, variantId: string, body: object) =>
    http().patch(`/v1/seller/variants/${variantId}/stock`).set('authorization', loja.auth).send(body);
  const porTamanho = (variants: SellerVariant[]) => Object.fromEntries(variants.map((v) => [`${v.size}/${v.color}`, v]));

  beforeAll(async () => {
    t = await startTestApp();
    // Escuta uma vez só: sem isso, o supertest abre o servidor a cada pedido, e os 10
    // simultâneos do AC-078 estouram o limite de ouvintes do Node (aviso no log).
    const server = t.app.getHttpServer() as Server;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const feminino = await createCategory(t.prisma, 'feminino');
    vestidos = await createCategory(t.prisma, 'vestidos', { parentId: feminino });
    tenis = await createCategory(t.prisma, 'tenis', { sizeType: 'SHOES' });
    bolsas = await createCategory(t.prisma, 'bolsas', { sizeType: 'ONE_SIZE' });
    ana = await createStore(t, 'Ana', vestidos);
    bruno = await createStore(t, 'Bruno', vestidos);
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.productImage.deleteMany();
    await t.prisma.upload.deleteMany();
    await t.prisma.productVariant.deleteMany();
    await t.prisma.product.deleteMany();
  });

  // Dado: um produto de uma categoria de roupas
  // Quando: o vendedor envia a grade (tamanho × cor, com preço, preço "de", estoque, peso, hex e SKU opcional)
  // Então: a grade fica salva, e o SKU omitido é gerado do slug, do tamanho e da cor
  // E: o produto passa a ter como menor preço o da variante mais barata
  it('AC-063: salvar a grade de variantes @spec:AC-063 @spec:US-024', async () => {
    const produto = await criar(ana);

    const res = await gravarGrade(
      ana,
      produto.id,
      [
        variantOf('G', 'Preto', { priceCents: 21900, compareAtCents: 25900 }),
        variantOf('m', 'Preto', { colorHex: '#1a1a1a' }),
        variantOf('P', 'Azul Petróleo', { sku: 'vest-p-azul', priceCents: 17900, stock: 0 }),
      ],
      '"1"',
    );

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.headers.etag).toBe('"2"');
    // Na ordem da grade de tamanhos; tamanho, hex e SKU informados em maiúsculas.
    expect(res.body.variants.map((v: SellerVariant) => `${v.size}/${v.color}`)).toEqual(['P/Azul Petróleo', 'M/Preto', 'G/Preto']);
    expect(res.body.variants).toEqual([
      expect.objectContaining({ sku: 'VEST-P-AZUL', priceCents: 17900, stock: 0, compareAtCents: null }),
      expect.objectContaining({ sku: 'VESTIDO-MIDI-DE-LINHO-M-PRETO', colorHex: '#1A1A1A', reserved: 0, weightGrams: 300 }),
      expect.objectContaining({ sku: 'VESTIDO-MIDI-DE-LINHO-G-PRETO', priceCents: 21900, compareAtCents: 25900 }),
    ]);
    // O menor preço conta a variante sem estoque: ela continua à venda quando repuser.
    expect((await abrir(ana, produto.id)).body).toMatchObject({ minPriceCents: 17900, version: 2 });

    const lida = await lerGrade(ana, produto.id);
    expect([lida.status, lida.headers.etag]).toEqual([200, '"2"']);
    expect(lida.body).toEqual(res.body);
    expect((await lerGrade(bruno, produto.id)).status).toBe(404);

    // Cada tipo de categoria tem a sua grade: calçados de 33 a 46, tamanho único U.
    const tenisDaAna = await criar(ana, { title: 'Tênis de Corrida', categoryId: tenis });
    const bolsaDaAna = await criar(ana, { title: 'Bolsa de Couro', categoryId: bolsas });
    const calcados = await gravarGrade(ana, tenisDaAna.id, [variantOf('33', 'Branco'), variantOf('46', 'Branco')], '"1"');
    const unico = await gravarGrade(ana, bolsaDaAna.id, [variantOf('U', 'Caramelo')], '"1"');
    expect([calcados.status, unico.status]).toEqual([200, 200]);
    expect(unico.body.variants[0].sku).toBe('BOLSA-DE-COURO-U-CARAMELO');
  });

  // Dado: uma grade com tamanho fora da lista, combinação repetida, preço <= 0, preço "de" <= preço,
  //       estoque negativo, peso fora de 1 g a 30 kg ou cor sem hexadecimal válido
  // Quando: ela é enviada
  // Então: 400, com o campo de cada erro (ex.: variants.2.priceCents)
  // E: a grade anterior continua como estava
  it('AC-064: grade inválida é recusada inteira @spec:AC-064', async () => {
    const produto = await criar(ana);
    const anterior = await gravarGrade(ana, produto.id, [variantOf('M')], '"1"');
    expect(anterior.status).toBe(200);

    const formato = await gravarGrade(
      ana,
      produto.id,
      [
        variantOf('P'),
        variantOf('M', 'Preto', { priceCents: 0 }),
        variantOf('G', 'Preto', { stock: -1 }),
        variantOf('GG', 'Preto', { weightGrams: 0 }),
        variantOf('XGG', 'Preto', { weightGrams: 30_001 }),
        variantOf('PP', 'Preto', { colorHex: 'preto' }),
      ],
      '"2"',
    );
    const regras = await gravarGrade(
      ana,
      produto.id,
      [variantOf('M'), variantOf('38'), variantOf('G'), variantOf('M', 'preto'), variantOf('P', 'Preto', { compareAtCents: 19900 })],
      '"2"',
    );

    const campos = (res: { body: { errors: { field: string }[] } }) => res.body.errors.map((e) => e.field);
    expect([formato.status, formato.body.code]).toEqual([400, 'VALIDATION_FAILED']);
    expect(campos(formato)).toEqual([
      'variants.1.priceCents',
      'variants.2.stock',
      'variants.3.weightGrams',
      'variants.4.weightGrams',
      'variants.5.colorHex',
    ]);
    expect(regras.status).toBe(400);
    expect(campos(regras)).toEqual(['variants.1.size', 'variants.3.color', 'variants.4.compareAtCents']);

    const lida = await lerGrade(ana, produto.id);
    expect(lida.headers.etag).toBe('"2"');
    expect(lida.body.variants).toEqual(anterior.body.variants);

    // A categoria de outro tipo deixaria a grade com tamanhos fora da lista: recusada
    // enquanto houver variantes ativas, aceita com a grade vazia.
    const paraTenis = await http()
      .patch(`/v1/seller/products/${produto.id}`)
      .set('authorization', ana.auth)
      .set('if-match', '"2"')
      .send({ categoryId: tenis });
    expect([paraTenis.status, paraTenis.body.code, paraTenis.body.sizeType]).toEqual([422, 'SIZE_GRID_MISMATCH', 'SHOES']);
    await gravarGrade(ana, produto.id, [], '"2"');
    const comGradeVazia = await http()
      .patch(`/v1/seller/products/${produto.id}`)
      .set('authorization', ana.auth)
      .set('if-match', '"3"')
      .send({ categoryId: tenis });
    expect(comGradeVazia.status, JSON.stringify(comGradeVazia.body)).toBe(200);
  });

  // Dado: uma variante ativa de outro produto da mesma loja com o SKU VEST-M-PRETO
  // Quando: a grade de um produto traz uma variante com esse SKU
  // Então: 409 SKU_TAKEN, com o SKU repetido
  // E: outra loja pode usar o mesmo SKU sem conflito
  it('AC-065: o SKU é único dentro da loja @spec:AC-065', async () => {
    const vestido = await criar(ana, { title: 'Vestido' });
    const saia = await criar(ana, { title: 'Saia' });
    const doBruno = await criar(bruno, { title: 'Vestido do Bruno' });
    await gravarGrade(ana, vestido.id, [variantOf('M', 'Preto', { sku: 'VEST-M-PRETO' })], '"1"');

    const repetido = await gravarGrade(ana, saia.id, [variantOf('P'), variantOf('M', 'Preto', { sku: 'vest-m-preto' })], '"1"');
    const outraLoja = await gravarGrade(bruno, doBruno.id, [variantOf('M', 'Preto', { sku: 'VEST-M-PRETO' })], '"1"');

    expect([repetido.status, repetido.body.code, repetido.body.sku]).toEqual([409, 'SKU_TAKEN', 'VEST-M-PRETO']);
    expect(await t.prisma.productVariant.count({ where: { productId: saia.id } })).toBe(0);
    expect((await abrir(ana, saia.id)).body.version).toBe(1);
    expect(outraLoja.status, JSON.stringify(outraLoja.body)).toBe(200);

    // A variante arquivada libera o SKU (índice só entre as ativas).
    await gravarGrade(ana, vestido.id, [variantOf('G')], '"2"');
    const liberado = await gravarGrade(ana, saia.id, [variantOf('M', 'Preto', { sku: 'VEST-M-PRETO' })], '"1"');
    expect(liberado.status, JSON.stringify(liberado.body)).toBe(200);
  });

  // Dado: um produto com as variantes M/preto e G/preto
  // Quando: o vendedor envia uma grade nova com M/preto (preço novo) e P/preto
  // Então: M/preto mantém o id com o preço novo; P/preto é criada; G/preto é arquivada, não apagada
  // E: se G/preto voltar, a variante arquivada é reativada com o mesmo id
  it('AC-066: trocar a grade preserva as variantes que continuam @spec:AC-066', async () => {
    const produto = await criar(ana);
    const primeira = await gravarGrade(ana, produto.id, [variantOf('M'), variantOf('G'), variantOf('G', 'Vermelho')], '"1"');
    const antes = porTamanho(primeira.body.variants as SellerVariant[]);
    // Uma foto da cor vermelha: quando a cor sai da grade, a foto passa a valer para todas (ASM-027).
    await t.prisma.upload.create({
      data: { path: `sellers/${ana.sellerId}/foto.webp`, sellerId: ana.sellerId, contentType: 'image/webp', sizeBytes: 1000 },
    });
    await t.prisma.productImage.create({
      data: { productId: produto.id, path: `sellers/${ana.sellerId}/foto.webp`, position: 0, color: 'Vermelho' },
    });

    const segunda = await gravarGrade(ana, produto.id, [variantOf('M', 'Preto', { priceCents: 15900 }), variantOf('P')], '"2"');

    expect(segunda.status, JSON.stringify(segunda.body)).toBe(200);
    const depois = porTamanho(segunda.body.variants as SellerVariant[]);
    expect(Object.keys(depois)).toEqual(['P/Preto', 'M/Preto']);
    expect(depois['M/Preto']).toMatchObject({ id: antes['M/Preto']?.id, priceCents: 15900, sku: antes['M/Preto']?.sku });
    const arquivada = await t.prisma.productVariant.findUniqueOrThrow({ where: { id: antes['G/Preto']?.id } });
    expect(arquivada.archivedAt).not.toBeNull();
    expect(await t.prisma.productVariant.count({ where: { productId: produto.id } })).toBe(4);
    expect((await abrir(ana, produto.id)).body.minPriceCents).toBe(15900);
    expect((await t.prisma.productImage.findFirstOrThrow({ where: { productId: produto.id } })).color).toBeNull();

    const terceira = await gravarGrade(ana, produto.id, [variantOf('M'), variantOf('P'), variantOf('G', 'Preto', { stock: 9 })], '"3"');
    const reativada = porTamanho(terceira.body.variants as SellerVariant[])['G/Preto'];
    expect(reativada).toMatchObject({ id: antes['G/Preto']?.id, stock: 9 });
    expect(await t.prisma.productVariant.count({ where: { productId: produto.id } })).toBe(4);
  });

  // A grade passa pela mesma versão das outras escritas (AC-075) e não muda produto arquivado (AC-076).
  it('a grade exige a versão certa e não muda produto arquivado @spec:AC-075 @spec:AC-076', async () => {
    const produto = await criar(ana);
    const semIfMatch = await gravarGrade(ana, produto.id, [variantOf('M')]);
    const atrasada = await gravarGrade(ana, produto.id, [variantOf('M')], '"7"');
    expect([semIfMatch.status, semIfMatch.body.code]).toEqual([428, 'PRECONDITION_REQUIRED']);
    expect([atrasada.status, atrasada.body.currentVersion]).toEqual([412, 1]);

    await http().delete(`/v1/seller/products/${produto.id}`).set('authorization', ana.auth).set('if-match', '"1"');
    const arquivado = await gravarGrade(ana, produto.id, [variantOf('M')], '"2"');
    expect([arquivado.status, arquivado.body.code]).toEqual([422, 'INVALID_STATE_TRANSITION']);
    expect(await t.prisma.productVariant.count()).toBe(0);
  });

  // Dado: uma variante com estoque 10, de um produto da loja do vendedor
  // Quando: ele envia { delta: -3 } ou { absolute: 25 }
  // Então: o estoque passa a 7 ou a 25, e a resposta traz o valor novo
  // E: a variante de outra loja responde 404
  it('AC-077: ajustar por diferença ou por valor final @spec:AC-077 @spec:US-028', async () => {
    const produto = await criar(ana);
    const variante = (await gravarGrade(ana, produto.id, [variantOf('M', 'Preto', { stock: 10 })], '"1"')).body.variants[0] as SellerVariant;

    const menosTres = await ajustar(ana, variante.id, { delta: -3 });
    const vinteECinco = await ajustar(ana, variante.id, { absolute: 25 });
    const deOutraLoja = await ajustar(bruno, variante.id, { delta: 1 });
    const osDois = await ajustar(ana, variante.id, { delta: 1, absolute: 2 });
    const nenhum = await ajustar(ana, variante.id, {});
    const demais = await ajustar(ana, variante.id, { delta: 99_999 });

    expect([menosTres.status, menosTres.body]).toEqual([200, { id: variante.id, stock: 7 }]);
    expect(vinteECinco.body).toEqual({ id: variante.id, stock: 25 });
    expect([deOutraLoja.status, deOutraLoja.body.code]).toEqual([404, 'VARIANT_NOT_FOUND']);
    expect([osDois.status, nenhum.status]).toEqual([400, 400]);
    expect([demais.status, demais.body.errors?.[0]?.field]).toEqual([400, 'delta']);
    // O ajuste não muda a versão do produto: a aba com a grade aberta não leva 412.
    expect((await abrir(ana, produto.id)).body.version).toBe(2);
    expect((await lerGrade(ana, produto.id)).body.variants[0].stock).toBe(25);

    // Variante arquivada some do ajuste; produto arquivado não muda mais.
    await http().delete(`/v1/seller/products/${produto.id}`).set('authorization', ana.auth).set('if-match', '"2"');
    const noArquivado = await ajustar(ana, variante.id, { delta: 1 });
    expect([noArquivado.status, noArquivado.body.code]).toEqual([422, 'INVALID_STATE_TRANSITION']);
  });

  // Dado: uma variante com estoque 10
  // Quando: chegam 10 ajustes { delta: -1 } ao mesmo tempo, seguidos de um { delta: -5 }
  // Então: os 10 primeiros são todos aplicados (estoque 0), sem perder nenhum
  // E: o -5 responde 422 STOCK_WOULD_BE_NEGATIVE, e o estoque continua 0
  it('AC-078: ajustes simultâneos não se perdem e o estoque nunca fica negativo @spec:AC-078', async () => {
    const produto = await criar(ana);
    const variante = (await gravarGrade(ana, produto.id, [variantOf('M', 'Preto', { stock: 10 })], '"1"')).body.variants[0] as SellerVariant;

    const simultaneos = await Promise.all(Array.from({ length: 10 }, () => ajustar(ana, variante.id, { delta: -1 })));
    const menosCinco = await ajustar(ana, variante.id, { delta: -5 });
    const absolutoNegativo = await ajustar(ana, variante.id, { absolute: -1 });

    expect(simultaneos.map((res) => res.status)).toEqual(Array(10).fill(200));
    expect(simultaneos.map((res) => res.body.stock as number).toSorted((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([menosCinco.status, menosCinco.body.code, menosCinco.body.currentStock]).toEqual([422, 'STOCK_WOULD_BE_NEGATIVE', 0]);
    expect(absolutoNegativo.status).toBe(400);
    expect((await t.prisma.productVariant.findUniqueOrThrow({ where: { id: variante.id } })).stock).toBe(0);
  });
});
