import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserRolesService } from '../src/modules/identity/application/user-roles.service.js';
import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import {
  applicationOf,
  CHAVE_DA_CARLA,
  CHAVE_DO_BRUNO,
  CPF_ANA,
  createCategory,
  FakePixDirectory,
} from './support/seller-test-kit.js';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

describe('US-018 a US-020 — Admin decide, suspende e define a comissão das lojas', () => {
  let t: TestApp;
  let admin: TestPerson;
  let ana: TestPerson;
  let bruno: TestPerson;
  let carla: TestPerson;
  let categoria: string;
  const asaas = new FakePixDirectory();
  const http = () => request(t.app.getHttpServer());

  const lista = (status: string, person = admin) =>
    http().get('/v1/admin/sellers').query({ status }).set('authorization', person.auth);
  const decidir = (id: string, acao: string, body?: object) =>
    http().post(`/v1/admin/sellers/${id}/${acao}`).set('authorization', admin.auth).send(body);
  const comissao = (id: string, commissionBps: unknown) =>
    http().patch(`/v1/admin/sellers/${id}/commission`).set('authorization', admin.auth).send({ commissionBps });
  const papeis = async (person: TestPerson) =>
    (await http().get('/v1/me').set('authorization', person.auth)).body.roles as string[];
  const registros = (entityId: string) =>
    t.prisma.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } });

  /** Candidatura pela API (documento cifrado de verdade) e, se pedido, a situação direto no banco. */
  const loja = async (person: TestPerson, extra: Record<string, unknown> = {}, status: Status = 'PENDING'): Promise<string> => {
    const res = await http()
      .post('/v1/seller/application')
      .set('authorization', person.auth)
      .send(applicationOf(categoria, extra));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const id = res.body.id as string;
    if (status !== 'PENDING') await t.prisma.seller.update({ where: { id }, data: { status } });
    return id;
  };
  const daAna = () => loja(ana);
  const doBruno = (status: Status = 'PENDING') =>
    loja(bruno, { storeName: 'Loja do Bruno', document: '529.982.247-25', pixKey: CHAVE_DO_BRUNO }, status);
  const daCarla = (status: Status = 'PENDING') =>
    loja(carla, { storeName: 'Brechó da Carla', document: '390.533.447-05', pixKey: CHAVE_DA_CARLA }, status);

  beforeAll(async () => {
    t = await startTestApp([], { paymentGateway: asaas.asGateway() });
    admin = await createPerson(t.prisma, 'Alice', ['customer', 'admin']);
    ana = await createPerson(t.prisma, 'Ana');
    bruno = await createPerson(t.prisma, 'Bruno');
    carla = await createPerson(t.prisma, 'Carla');
    categoria = await createCategory(t.prisma, 'vestidos');
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.seller.deleteMany();
    await t.prisma.auditLog.deleteMany();
    const pessoas = [ana.id, bruno.id, carla.id];
    await t.prisma.user.updateMany({ where: { id: { in: pessoas } }, data: { roles: ['customer'] } });
    // Os papéis voltaram direto no banco: o cache de login precisa esquecer o teste anterior.
    for (const id of pessoas) t.app.get(UserRolesService).refresh(id);
  });

  // Dado: lojas em análise, aprovadas, rejeitadas e suspensas
  // Quando: o admin lista (GET /v1/admin/sellers?status=PENDING)
  // Então: recebe só as da situação pedida, da mais antiga para a mais nova, com nome, slug, CPF/CNPJ completo,
  //        conta dona, chave Pix, titular conferido e data da conferência
  // E: quem não é admin recebe 404
  it('AC-050: admin lista as lojas de uma situação, da mais antiga para a mais nova @spec:AC-050', async () => {
    const anaId = await daAna();
    const carlaId = await daCarla();
    await doBruno('APPROVED');
    // A Carla se candidatou antes da Ana: a ordem é a da candidatura, não a da gravação.
    await t.prisma.seller.update({ where: { id: carlaId }, data: { appliedAt: new Date(Date.now() - 60_000) } });

    const emAnalise = await lista('PENDING');
    const aprovadas = await lista('APPROVED');
    const suspensas = await lista('SUSPENDED');
    const naoAdmin = await lista('PENDING', ana);
    const semSituacao = await http().get('/v1/admin/sellers').set('authorization', admin.auth);

    expect(emAnalise.status).toBe(200);
    expect(emAnalise.body.map((s: { id: string }) => s.id)).toEqual([carlaId, anaId]);
    expect(emAnalise.body[1]).toMatchObject({
      status: 'PENDING',
      storeName: 'Ateliê da Ana',
      slug: 'atelie-da-ana',
      document: CPF_ANA,
      owner: { id: ana.id, name: 'Ana', email: 'ana@exemplo.com' },
      pixKey: {
        type: 'EMAIL',
        key: 'ana@atelie.dev.br',
        ownerName: 'Ana Souza',
        ownerDocument: '***.444.777-**',
        verifiedAt: expect.any(String),
      },
      commissionBps: null,
      effectiveCommissionBps: 1200,
    });
    expect(aprovadas.body.map((s: { storeName: string }) => s.storeName)).toEqual(['Loja do Bruno']);
    expect(suspensas.body).toEqual([]);
    expect(naoAdmin.status).toBe(404);
    expect(semSituacao.status).toBe(400);
  });

  // Dado: uma loja em análise
  // Quando: o admin aprova (POST /v1/admin/sellers/{id}/approve)
  // Então: a loja fica APPROVED com a data, e a dona ganha o papel seller já na próxima chamada (sem esperar o cache)
  // E: a decisão fica na auditoria (seller.approve)
  it('AC-051: aprovar dá o papel de vendedor já na próxima chamada da dona @spec:AC-051', async () => {
    const id = await daAna();
    const antes = await papeis(ana); // a Ana entra no cache de 60 s ainda como cliente

    const res = await decidir(id, 'approve');
    const depois = await papeis(ana);

    expect(antes).toEqual(['customer']);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ id, status: 'APPROVED', approvedAt: expect.any(String) });
    expect(depois).toEqual(['customer', 'seller']);
    const [registro, ...outros] = await registros(id);
    expect(outros).toEqual([]);
    expect(registro).toMatchObject({
      action: 'seller.approve',
      actorUserId: admin.id,
      entityType: 'seller',
      before: expect.objectContaining({ status: 'PENDING' }),
      after: expect.objectContaining({ status: 'APPROVED' }),
    });
    expect(JSON.stringify(registro)).not.toContain(CPF_ANA);
  });

  // Dado: uma loja em análise
  // Quando: o admin rejeita com um motivo
  // Então: a loja fica REJECTED, com o motivo e a data, e a decisão vai para a auditoria (seller.reject)
  // E: sem motivo, 400; aprovar ou rejeitar loja que não está em análise, 422 INVALID_STATE_TRANSITION
  it('AC-052: rejeitar exige motivo, e decisão fora de hora é recusada @spec:AC-052', async () => {
    const id = await daAna();
    const aprovadaId = await doBruno('APPROVED');

    const semMotivo = await decidir(id, 'reject', {});
    const motivoVazio = await decidir(id, 'reject', { reason: '   ' });
    const rejeitada = await decidir(id, 'reject', { reason: 'Fotos da marca não conferem.' });
    const aprovarRejeitada = await decidir(id, 'approve');
    const rejeitarAprovada = await decidir(aprovadaId, 'reject', { reason: 'Mudei de ideia.' });

    expect(semMotivo.status).toBe(400);
    expect(semMotivo.body.errors).toEqual([expect.objectContaining({ field: 'reason' })]);
    expect(motivoVazio.status).toBe(400);
    expect(rejeitada.status, JSON.stringify(rejeitada.body)).toBe(200);
    expect(rejeitada.body).toMatchObject({
      status: 'REJECTED',
      rejection: { reason: 'Fotos da marca não conferem.', rejectedAt: expect.any(String) },
    });
    for (const res of [aprovarRejeitada, rejeitarAprovada]) {
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_STATE_TRANSITION');
    }
    expect((await registros(id)).map((r) => r.action)).toEqual(['seller.reject']);
    expect(await registros(aprovadaId)).toEqual([]);
    expect(await papeis(ana)).toEqual(['customer']);
    // A pessoa vê o motivo no acompanhamento da candidatura (T-016).
    const minha = await http().get('/v1/seller/application').set('authorization', ana.auth);
    expect(minha.body.rejection.reason).toBe('Fotos da marca não conferem.');
  });

  // Dado: uma loja aprovada
  // Quando: o admin a suspende com um motivo e depois a reativa
  // Então: SUSPENDED e depois APPROVED, com as duas decisões na auditoria
  // E: suspender sem motivo, 400; suspender loja não aprovada ou reativar loja não suspensa, 422
  it('AC-053: suspender e reativar, sempre com registro @spec:AC-053', async () => {
    const id = await daAna();
    await decidir(id, 'approve');
    const pendenteId = await doBruno();

    const semMotivo = await decidir(id, 'suspend', {});
    const reativarAprovada = await decidir(id, 'reinstate');
    const suspensa = await decidir(id, 'suspend', { reason: 'Reclamações de entrega.' });
    const papeisSuspensa = await papeis(ana);
    const reativada = await decidir(id, 'reinstate');
    const suspenderPendente = await decidir(pendenteId, 'suspend', { reason: 'Teste.' });

    expect(semMotivo.status).toBe(400);
    expect(suspensa.status, JSON.stringify(suspensa.body)).toBe(200);
    expect(suspensa.body).toMatchObject({
      status: 'SUSPENDED',
      suspension: { reason: 'Reclamações de entrega.', suspendedAt: expect.any(String) },
    });
    expect(reativada.status).toBe(200);
    expect(reativada.body).toMatchObject({ status: 'APPROVED', suspension: null, approvedAt: suspensa.body.approvedAt });
    for (const res of [reativarAprovada, suspenderPendente]) {
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_STATE_TRANSITION');
    }
    // Suspender não tira o papel: a loja suspensa é barrada pela situação (T-018).
    expect(papeisSuspensa).toEqual(['customer', 'seller']);
    const acoes = await registros(id);
    expect(acoes.map((r) => r.action)).toEqual(['seller.approve', 'seller.suspend', 'seller.reinstate']);
    expect(acoes[1]).toMatchObject({
      before: expect.objectContaining({ status: 'APPROVED' }),
      after: expect.objectContaining({ status: 'SUSPENDED', suspensionReason: 'Reclamações de entrega.' }),
    });
    expect(await registros(pendenteId)).toEqual([]);
  });

  // Dado: uma loja
  // Quando: o admin define a comissão em pontos-base, ou null para voltar à padrão
  // Então: a loja mostra a comissão definida (ou a padrão, 12%), e a mudança vai para a auditoria com antes e depois
  // E: valor fora de 0 a 10000 responde 400
  it('AC-054: comissão própria da loja, ou de volta à padrão @spec:AC-054', async () => {
    const id = await daAna();

    const propria = await comissao(id, 800);
    const zero = await comissao(id, 0);
    const padrao = await comissao(id, null);
    const recusadas = await Promise.all([comissao(id, 10_001), comissao(id, -1), comissao(id, 12.5), comissao(id, '800')]);
    const semCampo = await http().patch(`/v1/admin/sellers/${id}/commission`).set('authorization', admin.auth).send({});

    expect(propria.status, JSON.stringify(propria.body)).toBe(200);
    expect(propria.body).toMatchObject({ commissionBps: 800, effectiveCommissionBps: 800 });
    expect(zero.body).toMatchObject({ commissionBps: 0, effectiveCommissionBps: 0 });
    expect(padrao.body).toMatchObject({ commissionBps: null, effectiveCommissionBps: 1200 });
    expect(recusadas.map((r) => r.status)).toEqual([400, 400, 400, 400]);
    expect(semCampo.status).toBe(400);
    const acoes = await registros(id);
    expect(acoes.map((r) => r.action)).toEqual(['seller.commission', 'seller.commission', 'seller.commission']);
    expect(acoes[0]).toMatchObject({
      before: expect.objectContaining({ commissionBps: null }),
      after: expect.objectContaining({ commissionBps: 800 }),
    });
    expect(acoes[2]).toMatchObject({
      before: expect.objectContaining({ commissionBps: 0 }),
      after: expect.objectContaining({ commissionBps: null }),
    });
  });

  it('loja inexistente responde 404, e quem não é admin não decide nada', async () => {
    const id = await daAna();

    const inexistente = await decidir(randomUUID(), 'approve');
    const pelaPropriaDona = await http().post(`/v1/admin/sellers/${id}/approve`).set('authorization', ana.auth);

    expect(inexistente.status).toBe(404);
    expect(inexistente.body.code).toBe('SELLER_NOT_FOUND');
    expect(pelaPropriaDona.status).toBe(404);
    expect((await t.prisma.seller.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
    expect(await t.prisma.auditLog.count()).toBe(0);
  });
});
