import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryNode[];
}

describe('US-012 e US-013 — Admin mantém as categorias', () => {
  let t: TestApp;
  let admin: TestPerson;
  let customer: TestPerson;
  const http = () => request(t.app.getHttpServer());

  const create = (body: object) => http().post('/v1/admin/categories').set('authorization', admin.auth).send(body);
  const patch = (id: string, body: object) =>
    http().patch(`/v1/admin/categories/${id}`).set('authorization', admin.auth).send(body);
  const archive = (id: string) => http().delete(`/v1/admin/categories/${id}`).set('authorization', admin.auth);
  const restore = (id: string) => http().post(`/v1/admin/categories/${id}/restore`).set('authorization', admin.auth);
  const publicTree = async () => (await http().get('/v1/categories')).body as CategoryNode[];
  const flatten = (nodes: CategoryNode[]): CategoryNode[] => nodes.flatMap((n) => [n, ...flatten(n.children)]);
  const publicSlugs = async () => flatten(await publicTree()).map((n) => n.slug);
  const snapshot = () => t.prisma.category.findMany({ orderBy: { slug: 'asc' } });

  /** Cria e devolve o id, falhando o teste se a criação não der 201. */
  const make = async (body: object): Promise<string> => {
    const res = await create(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    t = await startTestApp();
    admin = await createPerson(t.prisma, 'Alice', ['customer', 'admin']);
    customer = await createPerson(t.prisma, 'Bruno', ['customer']);
  });

  afterAll(async () => {
    await t?.close();
  });

  // ── Acesso ──────────────────────────────────────────────────────────────────

  it('AC-022: admin abre a lista de categorias da área de admin @spec:AC-022', async () => {
    const res = await http().get('/v1/admin/categories').set('authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('AC-021: quem não é admin recebe 404 nas rotas de categorias do admin @spec:AC-021', async () => {
    const lista = await http().get('/v1/admin/categories').set('authorization', customer.auth);
    const criar = await http()
      .post('/v1/admin/categories')
      .set('authorization', customer.auth)
      .send({ name: 'Intrusa', sizeType: 'CLOTHING' });

    expect(lista.status).toBe(404);
    expect(criar.status).toBe(404);
    expect(await t.prisma.category.count({ where: { slug: 'intrusa' } })).toBe(0);
  });

  // ── Criar ───────────────────────────────────────────────────────────────────

  // Dado: um admin logado
  // Quando: ele cria uma categoria informando nome, tipo de tamanho e, opcionalmente, pai, slug, posição e guia
  // Então: a categoria é criada (201) e passa a aparecer na árvore pública
  // E: sem slug informado, ele é gerado do nome
  it('AC-026: admin cria departamento e subcategoria, que aparecem na árvore pública @spec:AC-026', async () => {
    const guia = { columns: ['Tamanho', 'Pé (cm)'], rows: [['36', '23,5'], ['37', '24']] };

    const dep = await create({ name: 'Calçados Femininos', sizeType: 'SHOES' });
    const sub = await create({
      name: 'Sandálias',
      slug: 'sandalias-femininas',
      parentId: dep.body.id,
      position: 3,
      sizeType: 'SHOES',
      sizeChart: guia,
    });

    expect(dep.status).toBe(201);
    expect(dep.body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      parentId: null,
      name: 'Calçados Femininos',
      slug: 'calcados-femininos',
      position: 0,
      sizeType: 'SHOES',
      sizeChart: null,
      archivedAt: null,
    });
    expect(sub.status).toBe(201);
    expect(sub.body).toMatchObject({ parentId: dep.body.id, slug: 'sandalias-femininas', position: 3, sizeChart: guia });

    const noArvore = (await publicTree()).find((n) => n.id === dep.body.id);
    expect(noArvore?.children.map((c) => c.slug)).toEqual(['sandalias-femininas']);
  });

  // Dado: um admin logado
  // Quando: ele envia uma categoria sem nome, com tipo de tamanho desconhecido, pai inexistente ou guia fora do formato
  // Então: nada é gravado e a resposta é 400 com a lista de campos inválidos (errors)
  // E: slug já usado é recusado com 409 e o código SLUG_TAKEN
  it('AC-027: dados inválidos voltam 400 com o motivo de cada campo e nada é gravado @spec:AC-027', async () => {
    const antes = await snapshot();

    const vazio = await create({});
    const tipoErrado = await create({ name: 'Bonés', sizeType: 'XL' });
    const guiaTorta = await create({
      name: 'Bermudas',
      sizeType: 'CLOTHING',
      sizeChart: { columns: ['Tamanho', 'Cintura'], rows: [['P', '70'], ['M']] },
    });
    const paiInexistente = await create({ name: 'Órfã', sizeType: 'CLOTHING', parentId: randomUUID() });

    for (const res of [vazio, tipoErrado, guiaTorta, paiInexistente]) {
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(res.body).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    }
    const campos = (res: { body: { errors: { field: string }[] } }) => res.body.errors.map((e) => e.field);
    expect(campos(vazio)).toEqual(expect.arrayContaining(['name', 'sizeType']));
    expect(campos(tipoErrado)).toEqual(['sizeType']);
    expect(campos(guiaTorta)).toEqual(['sizeChart.rows']);
    expect(campos(paiInexistente)).toEqual(['parentId']);
    expect(await snapshot()).toEqual(antes);
  });

  it('AC-027: slug já usado volta 409 SLUG_TAKEN @spec:AC-027', async () => {
    await make({ name: 'Mochilas', sizeType: 'ONE_SIZE' });
    const antes = await snapshot();

    const repetido = await create({ name: 'Mochilas', sizeType: 'ONE_SIZE' });
    const explicito = await create({ name: 'Outra', slug: 'mochilas', sizeType: 'ONE_SIZE' });

    for (const res of [repetido, explicito]) {
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ status: 409, code: 'SLUG_TAKEN' });
    }
    expect(await snapshot()).toEqual(antes);
  });

  // ── Editar e mover ──────────────────────────────────────────────────────────

  // Dado: um admin logado e uma categoria existente
  // Quando: ele muda nome, slug, posição, tipo de tamanho, guia de medidas ou a categoria pai
  // Então: a árvore pública passa a refletir a mudança
  it('AC-028: admin edita e move categoria, e a árvore pública reflete @spec:AC-028', async () => {
    const roupas = await make({ name: 'Roupas', sizeType: 'CLOTHING' });
    const praia = await make({ name: 'Praia', sizeType: 'CLOTHING' });
    const biquinis = await make({ name: 'Biquinis', sizeType: 'CLOTHING', parentId: roupas });
    const guia = { columns: ['Tamanho', 'Quadril'], rows: [['P', '92']] };

    const res = await patch(biquinis, {
      name: 'Biquínis',
      slug: 'biquinis-praia',
      position: 2,
      sizeType: 'CLOTHING',
      sizeChart: guia,
      parentId: praia,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: biquinis, name: 'Biquínis', slug: 'biquinis-praia', position: 2, parentId: praia, sizeChart: guia });
    const arvore = await publicTree();
    expect(arvore.find((n) => n.id === praia)?.children.map((c) => c.name)).toEqual(['Biquínis']);
    expect(arvore.find((n) => n.id === roupas)?.children).toEqual([]);

    const paraRaiz = await patch(biquinis, { parentId: null });
    expect(paraRaiz.status).toBe(200);
    expect((await publicTree()).some((n) => n.id === biquinis)).toBe(true);
  });

  // E: mover uma categoria para dentro dela mesma ou de uma descendente é recusado (422, INVALID_CATEGORY_PARENT)
  // E: criar ou mover para dentro de uma categoria arquivada também é recusado (422)
  it('AC-028: mover para si mesma, para uma descendente ou para uma arquivada é recusado @spec:AC-028', async () => {
    const a = await make({ name: 'Nível A', sizeType: 'CLOTHING' });
    const b = await make({ name: 'Nível B', sizeType: 'CLOTHING', parentId: a });
    const c = await make({ name: 'Nível C', sizeType: 'CLOTHING', parentId: b });
    const arquivada = await make({ name: 'Arquivada', sizeType: 'CLOTHING' });
    expect((await archive(arquivada)).status).toBe(204);
    const antes = await snapshot();

    const tentativas = [
      await patch(a, { parentId: a }),
      await patch(a, { parentId: c }),
      await patch(b, { parentId: arquivada }),
      await create({ name: 'Dentro da arquivada', sizeType: 'CLOTHING', parentId: arquivada }),
    ];

    for (const res of tentativas) {
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ status: 422, code: 'INVALID_CATEGORY_PARENT' });
    }
    expect(await snapshot()).toEqual(antes);
  });

  it('AC-028: editar sem nenhum campo ou com slug de outra categoria é recusado @spec:AC-028', async () => {
    const x = await make({ name: 'Cintos', sizeType: 'ONE_SIZE' });
    await make({ name: 'Carteiras', sizeType: 'ONE_SIZE' });

    expect((await patch(x, {})).status).toBe(400);
    expect((await patch(x, { slug: 'carteiras' })).body).toMatchObject({ status: 409, code: 'SLUG_TAKEN' });
  });

  // ── Arquivar e restaurar ────────────────────────────────────────────────────

  // Dado: um admin logado e uma categoria com subcategorias
  // Quando: ele arquiva a categoria (DELETE)
  // Então: ela e todas as descendentes somem da árvore pública (204), mas continuam no banco marcadas como arquivadas
  // E: a lista do admin continua mostrando as arquivadas, com a data
  // E: o slug de uma categoria arquivada continua reservado
  it('AC-029: arquivar leva junto as descendentes, que somem só da árvore pública @spec:AC-029', async () => {
    const infantil = await make({ name: 'Infantil', sizeType: 'CLOTHING' });
    const meninas = await make({ name: 'Meninas', slug: 'meninas', sizeType: 'CLOTHING', parentId: infantil });
    const vestidos = await make({ name: 'Vestidos', slug: 'vestidos-meninas', sizeType: 'CLOTHING', parentId: meninas });

    const res = await archive(infantil);

    expect(res.status).toBe(204);
    expect(await publicSlugs()).not.toEqual(expect.arrayContaining(['infantil']));
    expect(await publicSlugs()).not.toContain('meninas');
    expect(await publicSlugs()).not.toContain('vestidos-meninas');

    const noBanco = await t.prisma.category.findMany({ where: { id: { in: [infantil, meninas, vestidos] } } });
    expect(noBanco).toHaveLength(3);
    for (const cat of noBanco) expect(cat.archivedAt).toBeInstanceOf(Date);

    const lista = (await http().get('/v1/admin/categories').set('authorization', admin.auth)).body as (CategoryNode & {
      archivedAt: string | null;
    })[];
    const infantilNaLista = lista.find((n) => n.id === infantil);
    expect(infantilNaLista?.archivedAt).toEqual(expect.any(String));
    expect(infantilNaLista?.children.map((c) => c.slug)).toEqual(['meninas']);

    const reuso = await create({ name: 'Meninas', slug: 'meninas', sizeType: 'CLOTHING' });
    expect(reuso.status).toBe(409);
    expect(reuso.body.code).toBe('SLUG_TAKEN');
  });

  it('AC-029: categoria que não existe (ou id fora do formato) responde 404 @spec:AC-029', async () => {
    const respostas = [
      await archive(randomUUID()),
      await restore(randomUUID()),
      await patch(randomUUID(), { name: 'X' }),
      await archive('nao-e-um-id'),
    ];

    for (const res of respostas) {
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    }
  });

  // Dado: um admin logado e uma categoria arquivada cuja pai está ativa (ou que é de primeiro nível)
  // Quando: ele restaura a categoria
  // Então: só ela volta para a árvore pública (200); as descendentes continuam arquivadas
  // E: restaurar uma categoria cuja pai está arquivada é recusado (422)
  it('AC-033: restaurar devolve só a categoria escolhida @spec:AC-033', async () => {
    const acessorios = await make({ name: 'Acessórios Teste', sizeType: 'ONE_SIZE' });
    const bolsas = await make({ name: 'Bolsas Teste', sizeType: 'ONE_SIZE', parentId: acessorios });
    await make({ name: 'Clutches Teste', sizeType: 'ONE_SIZE', parentId: bolsas });
    await archive(acessorios);

    const res = await restore(acessorios);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: acessorios, archivedAt: null });
    const noArvore = (await publicTree()).find((n) => n.id === acessorios);
    expect(noArvore?.children).toEqual([]);
    expect(await publicSlugs()).not.toContain('clutches-teste');
  });

  it('AC-033: restaurar com a pai arquivada é recusado sem alterar nada @spec:AC-033', async () => {
    const pai = await make({ name: 'Pai Arquivado', sizeType: 'CLOTHING' });
    const filha = await make({ name: 'Filha Arquivada', sizeType: 'CLOTHING', parentId: pai });
    await archive(pai);
    const antes = await snapshot();

    const res = await restore(filha);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'INVALID_CATEGORY_PARENT' });
    expect(await snapshot()).toEqual(antes);
  });

  // ── Auditoria ───────────────────────────────────────────────────────────────

  // Dado: um admin logado
  // Quando: ele cria, edita, arquiva ou restaura uma categoria com sucesso
  // Então: fica gravado um registro com quem fez, a ação, o tipo e o id da entidade, antes e depois e o IP
  // E: no arquivamento em cascata, o "depois" lista as descendentes arquivadas junto
  // E: leituras e tentativas recusadas não geram registro
  it('AC-030: cada escrita do admin em categorias gera um registro com antes e depois @spec:AC-030', async () => {
    const id = await make({ name: 'Óculos', sizeType: 'ONE_SIZE' });
    const filha = await make({ name: 'Óculos de Sol', sizeType: 'ONE_SIZE', parentId: id });
    await patch(id, { name: 'Óculos e Lentes' });
    await archive(id);
    await restore(id);

    const logs = await t.prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } });

    expect(logs.map((l) => l.action)).toEqual(['category.create', 'category.update', 'category.archive', 'category.restore']);
    for (const log of logs) {
      expect(log).toMatchObject({ actorUserId: admin.id, entityType: 'category', entityId: id });
      expect(log.ip).toMatch(/127\.0\.0\.1|::1/);
    }
    const [criar, editar, arquivar, restaurar] = logs;
    expect(criar?.before).toBeNull();
    expect(criar?.after).toMatchObject({ name: 'Óculos', slug: 'oculos' });
    expect(editar?.before).toMatchObject({ name: 'Óculos' });
    expect(editar?.after).toMatchObject({ name: 'Óculos e Lentes' });
    expect(arquivar?.before).toMatchObject({ archivedAt: null });
    expect(arquivar?.after).toMatchObject({ archivedAt: expect.any(String), archivedDescendantIds: [filha] });
    expect(restaurar?.after).toMatchObject({ archivedAt: null });
  });

  it('AC-030: leituras e tentativas recusadas não geram registro @spec:AC-030', async () => {
    const existente = await make({ name: 'Relógios', sizeType: 'ONE_SIZE' });
    const antes = await t.prisma.auditLog.count();

    await http().get('/v1/admin/categories').set('authorization', admin.auth);
    await create({});
    await create({ name: 'Relógios', sizeType: 'ONE_SIZE' });
    await patch(existente, { parentId: existente });
    await archive(randomUUID());
    await http().delete(`/v1/admin/categories/${existente}`).set('authorization', customer.auth);

    expect(await t.prisma.auditLog.count()).toBe(antes);
  });
});
