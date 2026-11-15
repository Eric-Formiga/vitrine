import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';
import {
  applicationOf,
  CHAVE_DO_BRUNO,
  CHAVE_INEXISTENTE,
  CPF_ANA,
  createCategory,
  FakePixDirectory,
} from './support/seller-test-kit.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('US-017 — Quem quer vender pede para abrir uma loja', () => {
  let t: TestApp;
  let ana: TestPerson;
  let bruno: TestPerson;
  let categoria: string;
  let arquivada: string;
  const asaas = new FakePixDirectory();
  const http = () => request(t.app.getHttpServer());

  const candidatar = (person: TestPerson, body: object) =>
    http().post('/v1/seller/application').set('authorization', person.auth).send(body);
  const minhaLoja = (person: TestPerson) => http().get('/v1/seller/application').set('authorization', person.auth);
  const lojas = () => t.prisma.seller.findMany();

  beforeAll(async () => {
    t = await startTestApp([], { paymentGateway: asaas.asGateway() });
    ana = await createPerson(t.prisma, 'Ana');
    bruno = await createPerson(t.prisma, 'Bruno');
    categoria = await createCategory(t.prisma, 'vestidos');
    arquivada = await createCategory(t.prisma, 'antiga', true);
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.seller.deleteMany();
    asaas.calls = [];
    asaas.down = false;
  });

  // Dado: uma pessoa logada, sem loja, e uma chave Pix cujo titular no Asaas tem o mesmo CPF da loja
  // Quando: ela envia a candidatura (POST /v1/seller/application)
  // Então: a loja é criada em análise, com o slug sugerido do nome, a chave, o titular e a data da conferência
  // E: a pessoa ainda não ganha o papel seller
  it('AC-043: candidatura válida cria a loja em análise com a chave conferida @spec:AC-043', async () => {
    const res = await candidatar(ana, applicationOf(categoria));

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      storeName: 'Ateliê da Ana',
      slug: 'atelie-da-ana',
      instagram: 'atelie.da.ana',
      mainCategoryId: categoria,
      pixKey: {
        type: 'EMAIL',
        key: 'ana@atelie.dev.br',
        ownerName: 'Ana Souza',
        ownerDocument: '***.444.777-**',
        verifiedAt: expect.any(String),
      },
    });
    expect(asaas.calls).toEqual(['EMAIL ana@atelie.dev.br']);
    const [loja] = await lojas();
    expect(loja).toMatchObject({ userId: ana.id, status: 'PENDING', pixKeyVerifiedAt: expect.any(Date) });
    const dona = await t.prisma.user.findUniqueOrThrow({ where: { id: ana.id } });
    expect(dona.roles).toEqual(['customer']);
  });

  // Dado: CPF/CNPJ inválido, categoria inexistente ou arquivada, ou slug já usado
  // Então: 400 VALIDATION_FAILED com o campo (documento, categoria) e 409 SLUG_TAKEN
  // E: nada é gravado, e o Asaas não é consultado
  it('AC-044: dados inválidos são recusados com o motivo de cada campo, sem consultar o Asaas @spec:AC-044', async () => {
    const documento = await candidatar(ana, applicationOf(categoria, { document: '111.444.777-36' }));
    const semCategoria = await candidatar(ana, applicationOf('0194f0a0-0000-7000-8000-000000000000'));
    const categoriaArquivada = await candidatar(ana, applicationOf(arquivada));
    await candidatar(bruno, applicationOf(categoria, { document: '529.982.247-25', pixKey: CHAVE_DO_BRUNO, slug: 'loja-do-bruno' }));
    asaas.calls = [];
    const slugOcupado = await candidatar(ana, applicationOf(categoria, { slug: 'loja-do-bruno' }));

    expect(documento.status).toBe(400);
    expect(documento.body).toMatchObject({ code: 'VALIDATION_FAILED', errors: [expect.objectContaining({ field: 'document' })] });
    for (const res of [semCategoria, categoriaArquivada]) {
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([expect.objectContaining({ field: 'mainCategoryId' })]);
    }
    expect(slugOcupado.status).toBe(409);
    expect(slugOcupado.body.code).toBe('SLUG_TAKEN');
    expect(asaas.calls).toEqual([]);
    expect(await t.prisma.seller.count({ where: { userId: ana.id } })).toBe(0);
  });

  // Dado: chave Pix de outro CPF/CNPJ, ou que não existe
  // Então: 422 PIX_KEY_OWNER_MISMATCH ou PIX_KEY_NOT_FOUND
  // E: nada é gravado
  it('AC-045: chave Pix de outro titular, ou que não existe, é recusada sem gravar nada @spec:AC-045', async () => {
    const deOutro = await candidatar(ana, applicationOf(categoria, { pixKey: CHAVE_DO_BRUNO }));
    const inexistente = await candidatar(ana, applicationOf(categoria, { pixKey: CHAVE_INEXISTENTE }));

    expect(deOutro.status).toBe(422);
    expect(deOutro.body.code).toBe('PIX_KEY_OWNER_MISMATCH');
    expect(inexistente.status).toBe(422);
    expect(inexistente.body.code).toBe('PIX_KEY_NOT_FOUND');
    expect(await lojas()).toEqual([]);
  });

  // Dado: o Asaas fora do ar ou com erro na consulta da chave
  // Então: 503 PIX_KEY_CHECK_UNAVAILABLE, pedindo para tentar mais tarde
  // E: nada é gravado
  it('AC-046: sem resposta do Asaas, a candidatura responde 503 e não grava nada @spec:AC-046', async () => {
    asaas.down = true;

    const res = await candidatar(ana, applicationOf(categoria));

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'PIX_KEY_CHECK_UNAVAILABLE', detail: expect.stringMatching(/tente de novo/i) });
    expect(await lojas()).toEqual([]);
  });

  // Dado: loja em análise, aprovada ou suspensa, ou rejeitada há menos de 7 dias
  // Então: 409 SELLER_APPLICATION_EXISTS; para a rejeitada, com a data de nova tentativa
  // E: rejeitada há 7 dias ou mais, a nova candidatura é aceita e a mesma loja volta para PENDING
  it('AC-047: uma candidatura ativa por conta; nova só 7 dias depois da rejeição @spec:AC-047', async () => {
    const primeira = await candidatar(ana, applicationOf(categoria));
    const lojaId = primeira.body.id as string;
    const emAnalise = await candidatar(ana, applicationOf(categoria));

    const recusadaEm = new Date(Date.now() - 3 * DAY_MS);
    await t.prisma.seller.update({
      where: { id: lojaId },
      data: { status: 'REJECTED', rejectedAt: recusadaEm, rejectionReason: 'Fotos da marca não conferem.' },
    });
    const cedoDemais = await candidatar(ana, applicationOf(categoria));

    for (const status of ['APPROVED', 'SUSPENDED'] as const) {
      await t.prisma.seller.update({ where: { id: lojaId }, data: { status } });
      const res = await candidatar(ana, applicationOf(categoria));
      expect(res.status, status).toBe(409);
    }

    await t.prisma.seller.update({
      where: { id: lojaId },
      data: { status: 'REJECTED', rejectedAt: new Date(Date.now() - 8 * DAY_MS), rejectionReason: 'Motivo antigo' },
    });
    const depois = await candidatar(ana, applicationOf(categoria, { storeName: 'Ana Ateliê', slug: 'ana-atelie' }));

    expect(emAnalise.status).toBe(409);
    expect(emAnalise.body.code).toBe('SELLER_APPLICATION_EXISTS');
    expect(cedoDemais.status).toBe(409);
    expect(cedoDemais.body.canReapplyAt).toBe(new Date(recusadaEm.getTime() + 7 * DAY_MS).toISOString());
    expect(depois.status, JSON.stringify(depois.body)).toBe(201);
    expect(depois.body).toMatchObject({ id: lojaId, status: 'PENDING', storeName: 'Ana Ateliê', slug: 'ana-atelie', rejection: null });
    expect(await lojas()).toHaveLength(1);
  });

  // Dado: uma loja já cadastrada com o CPF 111.444.777-35
  // Quando: outra conta se candidata com o mesmo documento (com ou sem pontuação)
  // Então: 409 DOCUMENT_TAKEN, e nada é gravado
  // E: no banco, o documento não aparece em texto puro
  it('AC-048: uma loja por CPF/CNPJ, com o documento guardado criptografado @spec:AC-048', async () => {
    await candidatar(ana, applicationOf(categoria));

    const mesmoDocumento = await candidatar(bruno, applicationOf(categoria, { document: CPF_ANA, slug: 'outra-loja' }));
    const linhas = await t.prisma.$queryRaw<object[]>`SELECT * FROM sellers`;

    expect(mesmoDocumento.status).toBe(409);
    expect(mesmoDocumento.body.code).toBe('DOCUMENT_TAKEN');
    expect(linhas).toHaveLength(1);
    expect(JSON.stringify(linhas)).not.toContain(CPF_ANA);
    expect(JSON.stringify(linhas)).not.toContain('111.444.777-35');
  });

  // Dado: uma pessoa logada com candidatura
  // Quando: ela consulta a situação (GET /v1/seller/application)
  // Então: recebe a situação, os dados, o titular da chave, o motivo e a data de nova tentativa (se rejeitada) e o checklist
  // E: sem candidatura, a resposta é 404
  it('AC-049: a pessoa acompanha a própria candidatura @spec:AC-049', async () => {
    const semLoja = await minhaLoja(ana);
    const criada = await candidatar(ana, applicationOf(categoria));
    const emAnalise = await minhaLoja(ana);
    const recusadaEm = new Date();
    await t.prisma.seller.update({
      where: { id: criada.body.id as string },
      data: { status: 'REJECTED', rejectedAt: recusadaEm, rejectionReason: 'Fotos da marca não conferem.' },
    });
    const recusada = await minhaLoja(ana);

    expect(semLoja.status).toBe(404);
    expect(semLoja.body.code).toBe('SELLER_APPLICATION_NOT_FOUND');
    expect(emAnalise.status).toBe(200);
    expect(emAnalise.body).toMatchObject({
      status: 'PENDING',
      storeName: 'Ateliê da Ana',
      document: '***.444.777-**',
      pixKey: { ownerName: 'Ana Souza', ownerDocument: '***.444.777-**' },
      rejection: null,
      checklist: { store: true, pixKey: true, shipping: false },
    });
    expect(recusada.body).toMatchObject({
      status: 'REJECTED',
      rejection: {
        reason: 'Fotos da marca não conferem.',
        rejectedAt: recusadaEm.toISOString(),
        canReapplyAt: new Date(recusadaEm.getTime() + 7 * DAY_MS).toISOString(),
      },
    });
  });

  it('sem login, as rotas da candidatura respondem 401', async () => {
    const enviar = await http().post('/v1/seller/application').send(applicationOf(categoria));
    const consultar = await http().get('/v1/seller/application');

    expect([enviar.status, consultar.status]).toEqual([401, 401]);
  });
});
