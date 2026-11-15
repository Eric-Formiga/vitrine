import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserRolesService } from '../src/modules/identity/application/user-roles.service.js';
import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import {
  applicationOf,
  CHAVE_CPF_DA_ANA,
  CHAVE_DA_CARLA,
  CHAVE_DO_BRUNO,
  CHAVE_INEXISTENTE,
  CPF_ANA,
  createCategory,
  FakePixDirectory,
} from './support/seller-test-kit.js';

const FRETE = {
  originZip: '01310-100',
  rates: { N: 2990, NE: 2490, CO: 2290, SE: 1590, S: 1990 },
  freeShippingThresholdCents: 29900,
  handlingDays: 2,
};

describe('US-021 — A loja aprovada mantém a chave Pix e o frete', () => {
  let t: TestApp;
  let admin: TestPerson;
  let ana: TestPerson;
  let bruno: TestPerson;
  let carla: TestPerson;
  let dani: TestPerson;
  let categoria: string;
  const asaas = new FakePixDirectory();
  const http = () => request(t.app.getHttpServer());

  const get = (person: TestPerson, rota: string) => http().get(`/v1/seller/${rota}`).set('authorization', person.auth);
  const put = (person: TestPerson, rota: string, body: object) =>
    http().put(`/v1/seller/${rota}`).set('authorization', person.auth).send(body);
  const admin_ = (id: string, acao: string, body?: object) =>
    http().post(`/v1/admin/sellers/${id}/${acao}`).set('authorization', admin.auth).send(body);
  const trocas = () => t.prisma.auditLog.findMany({ where: { action: 'seller.pix_key_change' } });

  /** Candidatura pela API; `aprovar` e `suspender` passam pelas rotas do admin (T-017). */
  const loja = async (person: TestPerson, extra: Record<string, unknown>, ...decisoes: ('approve' | 'suspend')[]) => {
    const res = await http().post('/v1/seller/application').set('authorization', person.auth).send(applicationOf(categoria, extra));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const id = res.body.id as string;
    for (const decisao of decisoes) {
      const decidida = await admin_(id, decisao, decisao === 'suspend' ? { reason: 'Reclamações de entrega.' } : undefined);
      expect(decidida.status, JSON.stringify(decidida.body)).toBe(200);
    }
    return id;
  };
  const lojaDaAnaAprovada = () => loja(ana, {}, 'approve');

  beforeAll(async () => {
    t = await startTestApp([], { paymentGateway: asaas.asGateway() });
    admin = await createPerson(t.prisma, 'Alice', ['customer', 'admin']);
    ana = await createPerson(t.prisma, 'Ana');
    bruno = await createPerson(t.prisma, 'Bruno');
    carla = await createPerson(t.prisma, 'Carla');
    dani = await createPerson(t.prisma, 'Dani');
    categoria = await createCategory(t.prisma, 'vestidos');
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.seller.deleteMany();
    await t.prisma.auditLog.deleteMany();
    const pessoas = [ana.id, bruno.id, carla.id, dani.id];
    await t.prisma.user.updateMany({ where: { id: { in: pessoas } }, data: { roles: ['customer'] } });
    for (const id of pessoas) t.app.get(UserRolesService).refresh(id);
    asaas.calls = [];
    asaas.down = false;
  });

  // Dado: uma pessoa sem loja, com loja em análise ou rejeitada, e outra com loja suspensa
  // Quando: elas chamam uma rota da área do vendedor
  // Então: quem não tem o papel seller recebe 404; a loja suspensa recebe 403 SELLER_NOT_ACTIVE
  it('AC-055: a área do vendedor é só da loja aprovada @spec:AC-055', async () => {
    await loja(bruno, { storeName: 'Loja do Bruno', document: '529.982.247-25', pixKey: CHAVE_DO_BRUNO });
    const rejeitada = await loja(dani, { storeName: 'Loja da Dani', document: '390.533.447-05', pixKey: CHAVE_DA_CARLA });
    await admin_(rejeitada, 'reject', { reason: 'Fotos não conferem.' });
    const suspensa = await loja(ana, {}, 'approve', 'suspend');
    // A Carla não tem loja.

    const semLoja = await get(carla, 'pix-key');
    const emAnalise = await get(bruno, 'pix-key');
    const naoAprovada = await put(dani, 'shipping', FRETE);
    const suspensaChave = await get(ana, 'pix-key');
    const suspensaFrete = await put(ana, 'shipping', FRETE);

    for (const res of [semLoja, emAnalise, naoAprovada]) expect(res.status).toBe(404);
    for (const res of [suspensaChave, suspensaFrete]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SELLER_NOT_ACTIVE');
    }
    expect(await t.prisma.shippingSettings.count()).toBe(0);

    await admin_(suspensa, 'reinstate');
    expect((await get(ana, 'pix-key')).status).toBe(200);
  });

  // Dado: uma loja aprovada com uma chave Pix conferida
  // Quando: o vendedor envia uma chave nova (PUT /v1/seller/pix-key)
  // Então: com o titular certo, a chave nova vale, com o titular e a data da nova conferência, e vai para a auditoria
  // E: com titular errado, chave inexistente ou o Asaas fora, a resposta é a da candidatura, e a chave antiga continua
  it('AC-056: trocar a chave Pix confere o titular de novo @spec:AC-056', async () => {
    await lojaDaAnaAprovada();
    const antes = (await get(ana, 'pix-key')).body as { verifiedAt: string };

    const deOutro = await put(ana, 'pix-key', CHAVE_DO_BRUNO);
    const inexistente = await put(ana, 'pix-key', CHAVE_INEXISTENTE);
    asaas.down = true;
    const asaasFora = await put(ana, 'pix-key', CHAVE_CPF_DA_ANA);
    asaas.down = false;
    const aindaAntiga = await get(ana, 'pix-key');
    const trocasRecusadas = await trocas();

    const trocada = await put(ana, 'pix-key', CHAVE_CPF_DA_ANA);
    const depois = await get(ana, 'pix-key');

    expect([deOutro.status, deOutro.body.code]).toEqual([422, 'PIX_KEY_OWNER_MISMATCH']);
    expect([inexistente.status, inexistente.body.code]).toEqual([422, 'PIX_KEY_NOT_FOUND']);
    expect([asaasFora.status, asaasFora.body.code]).toEqual([503, 'PIX_KEY_CHECK_UNAVAILABLE']);
    expect(aindaAntiga.body).toMatchObject({ type: 'EMAIL', key: 'ana@atelie.dev.br' });
    expect(trocasRecusadas).toEqual([]);

    expect(trocada.status, JSON.stringify(trocada.body)).toBe(200);
    expect(trocada.body).toMatchObject({ type: 'CPF', key: CPF_ANA, ownerName: 'Ana Souza', ownerDocument: '***.444.777-**' });
    expect(new Date(trocada.body.verifiedAt as string).getTime()).toBeGreaterThan(new Date(antes.verifiedAt).getTime());
    expect(depois.body).toEqual(trocada.body);

    const [registro, ...outros] = await trocas();
    expect(outros).toEqual([]);
    expect(registro).toMatchObject({
      actorUserId: ana.id,
      entityType: 'seller',
      before: { pixKey: expect.objectContaining({ type: 'EMAIL', key: 'ana@atelie.dev.br' }) },
      after: { pixKey: expect.objectContaining({ type: 'CPF', key: '***.444.777-**' }) },
    });
    // A chave nova é o CPF: na trilha de auditoria ela vai mascarada.
    expect(JSON.stringify(registro)).not.toContain(CPF_ANA);
  });

  // Dado: uma loja aprovada
  // Quando: o vendedor envia a configuração de frete (PUT /v1/seller/shipping)
  // Então: fica salva, volta igual no GET, e o item "frete" do checklist fica pronto
  // E: CEP sem 8 dígitos, região faltando, valor negativo ou prazo fora de 1 a 5 respondem 400, com o campo
  it('AC-057: configurar o frete da loja @spec:AC-057', async () => {
    await lojaDaAnaAprovada();
    const antesDeConfigurar = await get(ana, 'shipping');

    const salva = await put(ana, 'shipping', FRETE);
    const lida = await get(ana, 'shipping');
    const checklist = (await http().get('/v1/seller/application').set('authorization', ana.auth)).body.checklist;
    const semGratis = await put(ana, 'shipping', { ...FRETE, freeShippingThresholdCents: null, handlingDays: 5 });

    expect(antesDeConfigurar.status).toBe(404);
    expect(antesDeConfigurar.body.code).toBe('SHIPPING_NOT_CONFIGURED');
    expect(salva.status, JSON.stringify(salva.body)).toBe(200);
    expect(salva.body).toEqual({ ...FRETE, originZip: '01310100' });
    expect(lida.body).toEqual(salva.body);
    expect(checklist).toEqual({ store: true, pixKey: true, shipping: true });
    expect(semGratis.body).toMatchObject({ freeShippingThresholdCents: null, handlingDays: 5 });

    const semSul: Partial<typeof FRETE.rates> = { ...FRETE.rates };
    delete semSul.S;
    const casos: [object, string][] = [
      [{ ...FRETE, originZip: '0131010' }, 'originZip'],
      [{ ...FRETE, rates: semSul }, 'rates.S'],
      [{ ...FRETE, rates: { ...FRETE.rates, N: -1 } }, 'rates.N'],
      [{ ...FRETE, handlingDays: 0 }, 'handlingDays'],
      [{ ...FRETE, handlingDays: 6 }, 'handlingDays'],
    ];
    for (const [corpo, campo] of casos) {
      const res = await put(ana, 'shipping', corpo);
      expect(res.status, campo).toBe(400);
      expect(res.body.errors, campo).toEqual([expect.objectContaining({ field: campo })]);
    }
    expect((await get(ana, 'shipping')).body).toMatchObject({ freeShippingThresholdCents: null, handlingDays: 5 });
  });
});
