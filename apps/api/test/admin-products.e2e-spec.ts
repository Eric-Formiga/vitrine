import type { Server } from 'node:http';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import { createCategory, createStore, insertImage, insertVariant, productOf, type TestStore } from './support/product-test-kit.js';

describe('US-029 — O admin suspende e reativa produtos', () => {
  let t: TestApp;
  let admin: TestPerson;
  let ana: TestStore;
  let vestidos: string;
  const http = () => request(t.app.getHttpServer());

  const decidir = (id: string, acao: 'suspend' | 'reinstate', body: object = {}, quem: TestPerson = admin) =>
    http().post(`/v1/admin/products/${id}/${acao}`).set('authorization', quem.auth).send(body);
  const abrir = (id: string) => http().get(`/v1/seller/products/${id}`).set('authorization', ana.auth);
  const trilha = (entityId: string) => t.prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } });
  /** Produto da Ana na situação pedida, com foto e variante (versão 1). */
  const produto = async (status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED') => {
    const res = await http().post('/v1/seller/products').set('authorization', ana.auth).send(productOf(vestidos));
    const id = res.body.id as string;
    await insertImage(t.prisma, ana, id);
    await insertVariant(t.prisma, ana, id, { size: 'M' });
    const now = new Date();
    await t.prisma.product.update({
      where: { id },
      data: {
        status,
        publishedAt: status === 'DRAFT' ? null : now,
        suspendedAt: status === 'SUSPENDED' ? now : null,
        suspensionReason: status === 'SUSPENDED' ? 'Foto de outra loja.' : null,
        archivedAt: status === 'ARCHIVED' ? now : null,
      },
    });
    return id;
  };

  beforeAll(async () => {
    t = await startTestApp();
    await new Promise<void>((resolve) => (t.app.getHttpServer() as Server).listen(0, resolve));
    vestidos = await createCategory(t.prisma, 'vestidos');
    admin = await createPerson(t.prisma, 'Alice', ['customer', 'admin']);
    ana = await createStore(t, 'Ana', vestidos);
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.auditLog.deleteMany();
    await t.prisma.productImage.deleteMany();
    await t.prisma.upload.deleteMany();
    await t.prisma.productVariant.deleteMany();
    await t.prisma.product.deleteMany();
  });

  // Dado: um produto ativo
  // Quando: o admin suspende com um motivo e depois reativa
  // Então: o produto passa a suspenso, com o motivo e a data, e depois volta a ativo
  // E: cada decisão vai para a trilha de auditoria, com o admin, o estado antes e o depois
  it('AC-079: suspender e reativar, sempre com registro @spec:AC-079 @spec:US-029', async () => {
    const id = await produto('ACTIVE');
    const publicadoEm = (await abrir(id)).body.publishedAt as string;

    const suspenso = await decidir(id, 'suspend', { reason: '  Foto copiada de outra loja.  ' });

    expect(suspenso.status, JSON.stringify(suspenso.body)).toBe(200);
    expect(suspenso.body).toMatchObject({
      id,
      sellerId: ana.sellerId,
      status: 'SUSPENDED',
      // Sem If-Match, mas a versão sobe: a aba do vendedor recebe 412 e recarrega.
      version: 2,
      suspension: { reason: 'Foto copiada de outra loja.', suspendedAt: expect.any(String) },
    });
    // O vendedor vê o motivo.
    expect((await abrir(id)).body.suspension.reason).toBe('Foto copiada de outra loja.');

    const reativado = await decidir(id, 'reinstate');
    expect(reativado.status).toBe(200);
    expect(reativado.body).toMatchObject({ status: 'ACTIVE', version: 3, suspension: null, publishedAt: publicadoEm });
    const gravado = await t.prisma.product.findUniqueOrThrow({ where: { id } });
    expect([gravado.suspendedAt, gravado.suspensionReason]).toEqual([null, null]);

    const registros = await trilha(id);
    expect(registros).toHaveLength(2);
    expect(registros[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'product.suspend',
      entityType: 'product',
      before: { status: 'ACTIVE', suspensionReason: null, suspendedAt: null, version: 1 },
      after: { status: 'SUSPENDED', suspensionReason: 'Foto copiada de outra loja.', suspendedAt: expect.any(String), version: 2 },
    });
    expect(registros[1]).toMatchObject({
      actorUserId: admin.id,
      action: 'product.reinstate',
      before: { status: 'SUSPENDED', version: 2 },
      after: { status: 'ACTIVE', suspensionReason: null, suspendedAt: null, version: 3 },
    });
  });

  // Dado: um produto em rascunho ou arquivado, e um produto suspenso
  // Quando: o admin tenta suspender o primeiro, o vendedor tenta publicar o suspenso, ou quem não é admin chama as rotas
  // Então: as duas primeiras tentativas respondem 422 (INVALID_STATE_TRANSITION); suspender sem motivo responde 400
  // E: quem não é admin recebe 404
  it('AC-080: decisão fora de hora e acesso de quem não é admin @spec:AC-080', async () => {
    const rascunho = await produto('DRAFT');
    const arquivado = await produto('ARCHIVED');
    const suspenso = await produto('SUSPENDED');
    const ativo = await produto('ACTIVE');

    for (const [id, status] of [
      [rascunho, 'DRAFT'],
      [arquivado, 'ARCHIVED'],
    ] as const) {
      const res = await decidir(id, 'suspend', { reason: 'Fora das regras.' });
      expect([res.status, res.body.code, res.body.currentStatus], status).toEqual([422, 'INVALID_STATE_TRANSITION', status]);
    }
    const reativarAtivo = await decidir(ativo, 'reinstate');
    expect([reativarAtivo.status, reativarAtivo.body.code]).toEqual([422, 'INVALID_STATE_TRANSITION']);

    const publicarSuspenso = await http()
      .post(`/v1/seller/products/${suspenso}/publish`)
      .set('authorization', ana.auth)
      .set('if-match', '"1"');
    expect([publicarSuspenso.status, publicarSuspenso.body.code, publicarSuspenso.body.currentStatus]).toEqual([
      422,
      'INVALID_STATE_TRANSITION',
      'SUSPENDED',
    ]);

    const semMotivo = await decidir(ativo, 'suspend', {});
    const motivoCurto = await decidir(ativo, 'suspend', { reason: 'x' });
    expect([semMotivo.status, motivoCurto.status]).toEqual([400, 400]);
    expect(semMotivo.body.errors[0].field).toBe('reason');

    const vendedora = await decidir(ativo, 'suspend', { reason: 'Tentando.' }, ana);
    const anonimo = await http().post(`/v1/admin/products/${ativo}/reinstate`);
    const inexistente = await decidir('0195a1b2-0000-7000-8000-000000000000', 'suspend', { reason: 'Não existe.' });
    expect(vendedora.status).toBe(404);
    expect(anonimo.status).toBe(401);
    expect([inexistente.status, inexistente.body.code]).toEqual([404, 'PRODUCT_NOT_FOUND']);

    // Nada mudou e nada foi registrado.
    expect((await t.prisma.product.findUniqueOrThrow({ where: { id: ativo } })).status).toBe('ACTIVE');
    expect((await abrir(rascunho)).body).toMatchObject({ status: 'DRAFT', version: 1 });
    expect(await t.prisma.auditLog.count()).toBe(0);
  });
});
