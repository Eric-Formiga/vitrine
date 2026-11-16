import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import { createCategory, createStore, insertVariant, productOf, type TestStore } from './support/product-test-kit.js';

describe('US-023 e US-027 — O vendedor cadastra, edita e arquiva produtos', () => {
  let t: TestApp;
  let ana: TestStore;
  let bruno: TestStore;
  let suspensa: TestStore;
  let semLoja: TestPerson;
  let vestidos: string;
  let feminino: string;
  let arquivada: string;
  const http = () => request(t.app.getHttpServer());

  const criar = (loja: TestPerson, extra: Record<string, unknown> = {}) =>
    http().post('/v1/seller/products').set('authorization', loja.auth).send(productOf(vestidos, extra));
  const abrir = (loja: TestPerson, id: string) => http().get(`/v1/seller/products/${id}`).set('authorization', loja.auth);
  const editar = (loja: TestPerson, id: string, body: object, ifMatch?: string) => {
    const req = http().patch(`/v1/seller/products/${id}`).set('authorization', loja.auth);
    return (ifMatch === undefined ? req : req.set('if-match', ifMatch)).send(body);
  };
  const arquivar = (loja: TestPerson, id: string, ifMatch: string) =>
    http().delete(`/v1/seller/products/${id}`).set('authorization', loja.auth).set('if-match', ifMatch);
  const listar = (loja: TestPerson, query = '') => http().get(`/v1/seller/products${query}`).set('authorization', loja.auth);

  beforeAll(async () => {
    t = await startTestApp();
    feminino = await createCategory(t.prisma, 'feminino');
    vestidos = await createCategory(t.prisma, 'vestidos', { parentId: feminino });
    arquivada = await createCategory(t.prisma, 'saias', { parentId: feminino, archived: true });
    ana = await createStore(t, 'Ana', vestidos);
    bruno = await createStore(t, 'Bruno', vestidos);
    suspensa = await createStore(t, 'Carla', vestidos, 'SUSPENDED');
    semLoja = await createPerson(t.prisma, 'Dani');
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.productVariant.deleteMany();
    await t.prisma.product.deleteMany();
  });

  // Dado: um vendedor com loja aprovada e uma categoria ativa sem subcategorias
  // Quando: ele envia título, descrição, categoria e condição (POST /v1/seller/products)
  // Então: o produto nasce rascunho, da loja dele, com slug do título único na loja (-2, -3...)
  // E: a resposta traz o ETag com a versão
  it('AC-060: criar o rascunho de um produto @spec:AC-060 @spec:US-023', async () => {
    const primeiro = await criar(ana);
    const segundo = await criar(ana);
    const terceiro = await criar(ana, { description: undefined });
    const doBruno = await criar(bruno);

    expect(primeiro.status, JSON.stringify(primeiro.body)).toBe(201);
    expect(primeiro.headers.etag).toBe('"1"');
    expect(primeiro.body).toMatchObject({
      title: 'Vestido Midi de Linho',
      slug: 'vestido-midi-de-linho',
      description: 'Linho lavado, forro de algodão.\nModelagem soltinha.',
      categoryId: vestidos,
      condition: 'NEW',
      status: 'DRAFT',
      version: 1,
      minPriceCents: null,
      publishedAt: null,
      suspension: null,
    });
    expect([segundo.body.slug, terceiro.body.slug]).toEqual(['vestido-midi-de-linho-2', 'vestido-midi-de-linho-3']);
    expect(terceiro.body.description).toBe('');
    // O slug é único por loja: o Bruno pode usar o mesmo.
    expect(doBruno.body.slug).toBe('vestido-midi-de-linho');

    const gravado = await t.prisma.product.findUniqueOrThrow({ where: { id: primeiro.body.id as string } });
    expect(gravado.sellerId).toBe(ana.sellerId);
  });

  // Dado: título fora de 3 a 120, descrição acima de 5.000, condição inválida, ou categoria
  //       inexistente, arquivada ou com subcategorias
  // Quando: o produto é criado ou editado
  // Então: 400 VALIDATION_FAILED com o campo de cada erro, e nada é gravado
  it('AC-061: informações inválidas são recusadas com o motivo de cada campo @spec:AC-061', async () => {
    const casos: [Record<string, unknown>, string][] = [
      [{ title: 'ab' }, 'title'],
      [{ title: 'x'.repeat(121) }, 'title'],
      [{ description: 'x'.repeat(5001) }, 'description'],
      [{ condition: 'NOVO' }, 'condition'],
      [{ categoryId: '0195a1b2-0000-7000-8000-000000000000' }, 'categoryId'],
      [{ categoryId: arquivada }, 'categoryId'],
      [{ categoryId: feminino }, 'categoryId'],
    ];
    for (const [extra, campo] of casos) {
      const res = await criar(ana, extra);
      expect(res.status, campo).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors, JSON.stringify(extra).slice(0, 60)).toEqual([expect.objectContaining({ field: campo })]);
    }
    expect(await t.prisma.product.count()).toBe(0);

    const criado = await criar(ana);
    const id = criado.body.id as string;
    const tituloCurto = await editar(ana, id, { title: 'ab' }, '"1"');
    const categoriaPai = await editar(ana, id, { categoryId: feminino }, '"1"');
    const vazio = await editar(ana, id, {}, '"1"');
    for (const res of [tituloCurto, categoriaPai, vazio]) expect(res.status).toBe(400);
    expect(categoriaPai.body.errors[0].message).toContain('subcategoria');
    expect((await abrir(ana, id)).body).toMatchObject({ title: 'Vestido Midi de Linho', categoryId: vestidos, version: 1 });
  });

  // Dado: duas lojas aprovadas, cada uma com produtos em situações diferentes
  // Quando: um vendedor lista (com filtro opcional de situação) e abre um produto
  // Então: só os dele, do mais recente para o mais antigo, com capa, menor preço e estoque total
  // E: o produto de outra loja responde 404
  it('AC-062: o vendedor lista e abre só os próprios produtos @spec:AC-062', async () => {
    const blusa = (await criar(ana, { title: 'Blusa de Seda' })).body;
    const saia = (await criar(ana, { title: 'Saia Plissada' })).body;
    const casaco = (await criar(ana, { title: 'Casaco de Lã' })).body;
    const doBruno = (await criar(bruno, { title: 'Camisa do Bruno' })).body;
    await arquivar(ana, saia.id as string, '"1"');
    await insertVariant(t.prisma, ana, blusa.id as string, { size: 'P', stock: 3 });
    await insertVariant(t.prisma, ana, blusa.id as string, { size: 'M', stock: 4 });
    await insertVariant(t.prisma, ana, blusa.id as string, { size: 'G', stock: 50, archived: true });

    const todos = await listar(ana);
    const arquivados = await listar(ana, '?status=ARCHIVED');
    const filtroInvalido = await listar(ana, '?status=VENDIDO');
    const meu = await abrir(ana, blusa.id as string);
    const deOutraLoja = await abrir(ana, doBruno.id as string);
    const inexistente = await abrir(ana, '0195a1b2-0000-7000-8000-000000000000');

    expect(todos.status).toBe(200);
    expect(todos.body.map((p: { title: string }) => p.title)).toEqual(['Casaco de Lã', 'Saia Plissada', 'Blusa de Seda']);
    expect(todos.body[2]).toMatchObject({
      id: blusa.id,
      status: 'DRAFT',
      version: 1,
      coverUrl: null,
      minPriceCents: null,
      // A variante arquivada não conta.
      totalStock: 7,
      suspension: null,
    });
    expect(todos.body[0]).toMatchObject({ id: casaco.id, totalStock: 0 });
    expect(arquivados.body.map((p: { id: string }) => p.id)).toEqual([saia.id]);
    expect(filtroInvalido.status).toBe(400);

    expect(meu.status).toBe(200);
    expect(meu.headers.etag).toBe('"1"');
    expect(meu.body).toMatchObject({ id: blusa.id, title: 'Blusa de Seda' });
    expect([deOutraLoja.status, deOutraLoja.body.code]).toEqual([404, 'PRODUCT_NOT_FOUND']);
    expect(inexistente.status).toBe(404);
    expect((await editar(ana, doBruno.id as string, { title: 'Roubada' }, '"1"')).status).toBe(404);

    // A área é só da loja aprovada (AC-055): quem não vende recebe 404; a loja suspensa, 403.
    const naoVende = await listar(semLoja);
    const lojaSuspensa = await criar(suspensa);
    expect(naoVende.status).toBe(404);
    expect([lojaSuspensa.status, lojaSuspensa.body.code]).toEqual([403, 'SELLER_NOT_ACTIVE']);
  });

  // Dado: um produto na versão N
  // Quando: o vendedor edita enviando If-Match com a versão N
  // Então: a mudança é gravada, e a resposta traz ETag N+1
  it('AC-074: edição com a versão certa @spec:AC-074', async () => {
    const id = (await criar(ana)).body.id as string;

    const primeira = await editar(ana, id, { title: 'Vestido Midi Off-White', condition: 'USED' }, '"1"');
    const comEtagFraco = await editar(ana, id, { description: 'Nova descrição.' }, 'W/"2"');

    expect(primeira.status, JSON.stringify(primeira.body)).toBe(200);
    expect(primeira.headers.etag).toBe('"2"');
    // O slug não acompanha o título: o endereço do produto fica estável.
    expect(primeira.body).toMatchObject({ title: 'Vestido Midi Off-White', condition: 'USED', slug: 'vestido-midi-de-linho', version: 2 });
    expect(comEtagFraco.headers.etag).toBe('"3"');
    expect((await abrir(ana, id)).body).toMatchObject({ title: 'Vestido Midi Off-White', description: 'Nova descrição.', version: 3 });
  });

  // Dado: um produto numa versão
  // Quando: chega uma escrita com If-Match desatualizado, ou sem If-Match
  // Então: desatualizado responde 412 PRODUCT_VERSION_CONFLICT com a versão atual; sem If-Match, 428
  // E: nada muda
  it('AC-075: versão desatualizada ou ausente é recusada @spec:AC-075', async () => {
    const id = (await criar(ana)).body.id as string;
    await editar(ana, id, { title: 'Aba um' }, '"1"');

    const atrasada = await editar(ana, id, { title: 'Aba dois' }, '"1"');
    const semIfMatch = await editar(ana, id, { title: 'Sem versão' });
    const formatoRuim = await editar(ana, id, { title: 'Formato ruim' }, '"dois"');
    const arquivarAtrasado = await arquivar(ana, id, '"1"');

    expect([atrasada.status, atrasada.body.code, atrasada.body.currentVersion]).toEqual([412, 'PRODUCT_VERSION_CONFLICT', 2]);
    expect([semIfMatch.status, semIfMatch.body.code]).toEqual([428, 'PRECONDITION_REQUIRED']);
    expect(formatoRuim.status).toBe(400);
    expect(arquivarAtrasado.status).toBe(412);
    expect((await abrir(ana, id)).body).toMatchObject({ title: 'Aba um', status: 'DRAFT', version: 2 });

    // Duas abas gravando ao mesmo tempo com a mesma versão: uma grava, a outra recebe 412.
    const corrida = await Promise.all([editar(ana, id, { title: 'Aba A' }, '"2"'), editar(ana, id, { title: 'Aba B' }, '"2"')]);
    expect(corrida.map((res) => res.status).toSorted()).toEqual([200, 412]);
    const vencedora = corrida.find((res) => res.status === 200)?.body.title as string;
    expect((await abrir(ana, id)).body).toMatchObject({ title: vencedora, version: 3 });
  });

  // Dado: um produto em rascunho, ativo ou suspenso
  // Quando: o vendedor arquiva (DELETE com If-Match)
  // Então: fica ARCHIVED e continua no banco, com as variantes (RN-17)
  // E: arquivado não aceita mais edição nem outro arquivamento (422 INVALID_STATE_TRANSITION)
  it('AC-076: arquivar tira o produto de cena sem apagar @spec:AC-076', async () => {
    const rascunho = (await criar(ana, { title: 'Rascunho' })).body.id as string;
    const ativo = (await criar(ana, { title: 'Ativo' })).body.id as string;
    const suspenso = (await criar(ana, { title: 'Suspenso' })).body.id as string;
    // Publicar e suspender pela API chegam na T-023; aqui a situação vai direto no banco.
    await t.prisma.product.update({ where: { id: ativo }, data: { status: 'ACTIVE', publishedAt: new Date() } });
    await t.prisma.product.update({ where: { id: suspenso }, data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'Foto de outra loja.' } });
    await insertVariant(t.prisma, ana, ativo, { size: 'M' });

    for (const id of [rascunho, ativo, suspenso]) {
      const res = await arquivar(ana, id, '"1"');
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.headers.etag).toBe('"2"');
      expect(res.body).toMatchObject({ status: 'ARCHIVED', archivedAt: expect.any(String) });
    }
    expect(await t.prisma.product.count({ where: { status: 'ARCHIVED' } })).toBe(3);
    expect(await t.prisma.productVariant.count({ where: { productId: ativo } })).toBe(1);

    const editarArquivado = await editar(ana, ativo, { title: 'De volta' }, '"2"');
    const arquivarDeNovo = await arquivar(ana, ativo, '"2"');
    for (const res of [editarArquivado, arquivarDeNovo]) {
      expect([res.status, res.body.code, res.body.currentStatus]).toEqual([422, 'INVALID_STATE_TRANSITION', 'ARCHIVED']);
    }
    expect((await abrir(ana, ativo)).body).toMatchObject({ title: 'Ativo', version: 2 });
  });
});
