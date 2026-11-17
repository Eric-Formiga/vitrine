import type { Server } from 'node:http';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import { createCategory, createStore, productOf, type TestStore, variantOf } from './support/product-test-kit.js';
import { FakeStorage } from './support/storage-test-kit.js';

const CINCO_MB = 5 * 1024 * 1024;

describe('US-025 — O vendedor envia as fotos do produto', () => {
  let t: TestApp;
  let ana: TestStore;
  let bruno: TestStore;
  let semLoja: TestPerson;
  let vestidos: string;
  const storage = new FakeStorage();
  const http = () => request(t.app.getHttpServer());

  const pedirUpload = (loja: TestPerson, body: object) => http().post('/v1/seller/uploads').set('authorization', loja.auth).send(body);
  /** Pede a URL e "envia" o arquivo, como o navegador faz; devolve o caminho. */
  const enviarFoto = async (loja: TestPerson, arquivoReal: { contentType?: string; sizeBytes?: number } = {}) => {
    const res = await pedirUpload(loja, { contentType: 'image/webp', sizeBytes: 120_000 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    storage.upload(res.body.path as string, arquivoReal);
    return res.body.path as string;
  };
  const criarProduto = async (loja: TestPerson, cores: string[] = ['Preto', 'Azul']) => {
    const res = await http().post('/v1/seller/products').set('authorization', loja.auth).send(productOf(vestidos));
    const id = res.body.id as string;
    await http()
      .put(`/v1/seller/products/${id}/variants`)
      .set('authorization', loja.auth)
      .set('if-match', '"1"')
      .send({ variants: cores.map((cor) => variantOf('M', cor)) });
    return id; // versão 2
  };
  const gravarFotos = (loja: TestPerson, id: string, images: object[], ifMatch?: string) => {
    const req = http().put(`/v1/seller/products/${id}/images`).set('authorization', loja.auth);
    return (ifMatch === undefined ? req : req.set('if-match', ifMatch)).send({ images });
  };
  const lerFotos = (loja: TestPerson, id: string) => http().get(`/v1/seller/products/${id}/images`).set('authorization', loja.auth);

  beforeAll(async () => {
    t = await startTestApp([], { storageGateway: storage });
    await new Promise<void>((resolve) => (t.app.getHttpServer() as Server).listen(0, resolve));
    vestidos = await createCategory(t.prisma, 'vestidos');
    ana = await createStore(t, 'Ana', vestidos);
    bruno = await createStore(t, 'Bruno', vestidos);
    semLoja = await createPerson(t.prisma, 'Dani');
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

  // Dado: um vendedor com loja aprovada
  // Quando: ele pede uma URL de upload com o tipo (jpeg, png ou webp) e o tamanho (até 5 MB)
  // Então: a resposta traz a URL assinada, a validade dada pelo Storage e o caminho na pasta da loja
  // E: outro tipo ou mais de 5 MB respondem 400, sem pedir nada ao Storage
  it('AC-067: pedir uma URL de upload @spec:AC-067', async () => {
    const res = await pedirUpload(ana, { contentType: 'image/jpeg', sizeBytes: CINCO_MB });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.path).toMatch(new RegExp(`^sellers/${ana.sellerId}/[0-9a-f-]{36}\\.jpg$`));
    expect(res.body.uploadUrl).toBe(`https://storage.test/upload/${res.body.path}?token=teste`);
    expect(new Date(res.body.expiresAt as string).getTime()).toBeGreaterThan(Date.now());
    expect(await t.prisma.upload.findUniqueOrThrow({ where: { path: res.body.path as string } })).toMatchObject({
      sellerId: ana.sellerId,
      contentType: 'image/jpeg',
      sizeBytes: CINCO_MB,
      detachedAt: null,
    });
    // Cada pedido tem um nome novo: dois envios nunca se sobrescrevem.
    const outro = await pedirUpload(ana, { contentType: 'image/jpeg', sizeBytes: 10 });
    expect(outro.body.path).not.toBe(res.body.path);

    const gif = await pedirUpload(ana, { contentType: 'image/gif', sizeBytes: 100 });
    const grande = await pedirUpload(ana, { contentType: 'image/png', sizeBytes: CINCO_MB + 1 });
    const vazio = await pedirUpload(ana, { contentType: 'image/png', sizeBytes: 0 });
    expect([gif.status, grande.status, vazio.status]).toEqual([400, 400, 400]);
    expect([gif.body.errors[0].field, grande.body.errors[0].field]).toEqual(['contentType', 'sizeBytes']);
    expect(storage.signed).toHaveLength(2);
    expect(await t.prisma.upload.count()).toBe(2);
    // Só a loja aprovada envia fotos.
    expect((await pedirUpload(semLoja, { contentType: 'image/png', sizeBytes: 10 })).status).toBe(404);
  });

  // Dado: um produto e arquivos já enviados ao Storage pela URL assinada
  // Quando: o vendedor salva a lista de imagens, na ordem, com texto alternativo e cor opcional
  // Então: ficam salvas nessa ordem, a primeira é a capa, e cada uma traz a URL pública
  // E: a lista substitui a anterior; as que saíram vão para a limpeza
  it('AC-068: salvar as imagens do produto @spec:AC-068 @spec:US-025', async () => {
    const id = await criarProduto(ana);
    const [frente, costas, detalhe] = [await enviarFoto(ana), await enviarFoto(ana), await enviarFoto(ana)];

    const res = await gravarFotos(
      ana,
      id,
      [{ path: frente, alt: 'Vestido de frente' }, { path: costas, color: 'preto' }, { path: detalhe, alt: ' Bordado ', color: 'Azul' }],
      '"2"',
    );

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.headers.etag).toBe('"3"');
    expect(res.body.images).toEqual([
      { path: frente, url: `https://storage.test/public/${frente}`, alt: 'Vestido de frente', color: null, position: 0 },
      // A cor fica com o nome da variante.
      { path: costas, url: `https://storage.test/public/${costas}`, alt: '', color: 'Preto', position: 1 },
      { path: detalhe, url: `https://storage.test/public/${detalhe}`, alt: 'Bordado', color: 'Azul', position: 2 },
    ]);
    const lida = await lerFotos(ana, id);
    expect([lida.status, lida.headers.etag]).toEqual([200, '"3"']);
    expect(lida.body).toEqual(res.body);
    expect((await lerFotos(bruno, id)).status).toBe(404);

    // A nova lista substitui a anterior: "costas" sai e vai para a limpeza.
    const troca = await gravarFotos(ana, id, [{ path: detalhe }, { path: frente }], '"3"');
    expect(troca.status, JSON.stringify(troca.body)).toBe(200);
    expect(troca.body.images.map((image: { path: string }) => image.path)).toEqual([detalhe, frente]);
    const uploads = await t.prisma.upload.findMany({ select: { path: true, detachedAt: true } });
    const desligada = (path: string) => uploads.find((upload) => upload.path === path)?.detachedAt;
    expect(desligada(costas)).toBeInstanceOf(Date);
    expect([desligada(frente), desligada(detalhe)]).toEqual([null, null]);

    // Voltar para a lista tira o arquivo da limpeza.
    await gravarFotos(ana, id, [{ path: costas }], '"4"');
    expect((await t.prisma.upload.findUniqueOrThrow({ where: { path: costas } })).detachedAt).toBeNull();
    // A lista vazia é aceita no rascunho; publicar é que exige foto (T-023).
    expect((await gravarFotos(ana, id, [], '"5"')).body.images).toEqual([]);
  });

  // Dado: mais de 8 imagens, caminho fora da pasta da loja, arquivo fora do Storage, tipo ou
  //       tamanho real fora do permitido, ou cor que nenhuma variante tem
  // Quando: a lista é salva
  // Então: 400 para o formato da lista e 422 INVALID_IMAGE para o arquivo, com a posição e o motivo
  // E: as imagens anteriores continuam como estavam
  it('AC-069: imagens inválidas são recusadas @spec:AC-069', async () => {
    const id = await criarProduto(ana);
    const boa = await enviarFoto(ana);
    expect((await gravarFotos(ana, id, [{ path: boa }], '"2"')).status).toBe(200);

    const nove = await Promise.all(Array.from({ length: 9 }, () => enviarFoto(ana)));
    const demais = await gravarFotos(ana, id, nove.map((path) => ({ path })), '"3"');
    const repetida = await gravarFotos(ana, id, [{ path: boa }, { path: boa }], '"3"');
    expect([demais.status, repetida.status]).toEqual([400, 400]);
    expect(demais.body.errors[0].field).toBe('images');

    const doBruno = await enviarFoto(bruno);
    const naoPedida = `sellers/${ana.sellerId}/nunca-pedida.webp`;
    storage.upload(naoPedida);
    const naoEnviada = (await pedirUpload(ana, { contentType: 'image/webp', sizeBytes: 10 })).body.path as string;
    const gif = await enviarFoto(ana, { contentType: 'image/gif' });
    const grande = await enviarFoto(ana, { sizeBytes: CINCO_MB + 1 });
    const outraBoa = await enviarFoto(ana);

    const casos: [object, string][] = [
      [{ path: doBruno }, 'outside-folder'],
      [{ path: `sellers/${ana.sellerId}/../${bruno.sellerId}/x.webp` }, 'outside-folder'],
      [{ path: naoPedida }, 'not-uploaded'],
      [{ path: naoEnviada }, 'missing'],
      [{ path: gif }, 'type'],
      [{ path: grande }, 'size'],
      [{ path: outraBoa, color: 'Verde' }, 'color'],
    ];
    for (const [imagem, motivo] of casos) {
      // A imagem ruim vai na posição 1, depois de uma boa.
      const res = await gravarFotos(ana, id, [{ path: boa }, imagem], '"3"');
      expect([res.status, res.body.code, res.body.position, res.body.reason], motivo).toEqual([422, 'INVALID_IMAGE', 1, motivo]);
    }

    const lida = await lerFotos(ana, id);
    expect(lida.headers.etag).toBe('"3"');
    expect(lida.body.images.map((image: { path: string }) => image.path)).toEqual([boa]);

    // As fotos passam pela mesma versão das outras escritas e não mudam produto arquivado.
    expect((await gravarFotos(ana, id, [{ path: boa }])).status).toBe(428);
    expect((await gravarFotos(ana, id, [{ path: boa }], '"2"')).status).toBe(412);
    await http().delete(`/v1/seller/products/${id}`).set('authorization', ana.auth).set('if-match', '"3"');
    const arquivado = await gravarFotos(ana, id, [], '"4"');
    expect([arquivado.status, arquivado.body.code]).toEqual([422, 'INVALID_STATE_TRANSITION']);
  });

  // Dado: produtos da loja, um deles com fotos
  // Quando: o vendedor lista os produtos
  // Então: cada um traz a URL pública da capa (a foto de posição 0), ou nulo sem fotos
  it('AC-062: a lista "Meus produtos" traz a capa @spec:AC-062', async () => {
    const comFoto = await criarProduto(ana);
    const semFoto = await criarProduto(ana);
    const [capa, segunda] = [await enviarFoto(ana), await enviarFoto(ana)];
    await gravarFotos(ana, comFoto, [{ path: capa }, { path: segunda }], '"2"');

    const lista = await http().get('/v1/seller/products').set('authorization', ana.auth);

    const porId = Object.fromEntries((lista.body as { id: string; coverUrl: string | null }[]).map((p) => [p.id, p.coverUrl]));
    expect(porId).toEqual({ [comFoto]: `https://storage.test/public/${capa}`, [semFoto]: null });
  });
});
