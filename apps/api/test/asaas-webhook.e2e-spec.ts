import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Payment, PaymentGateway, PixTransfer } from '../src/modules/payments/application/payment-gateway.port.js';
import { createApp } from '../src/create-app.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { startTestDatabase, type TestDatabase } from './support/postgres-container.js';

const TOKEN = 'token-dos-avisos-do-asaas-de-teste';

// Id real de uma cobrança Pix do sandbox (cassete pix-recebido.json). Sem captura de
// avisos reais neste spike (ASM-014): o formato segue a documentação do Asaas.
const PAGAMENTO_SANDBOX = 'pay_0_tfsjkpk8qvav8i';

/** Aviso no formato documentado pelo Asaas. O status do aviso diz RECEIVED de propósito. */
const avisoDePagamento = (eventId: string) => ({
  id: eventId,
  event: 'PAYMENT_RECEIVED',
  dateCreated: '2026-11-13 15:08:52',
  payment: {
    object: 'payment',
    id: PAGAMENTO_SANDBOX,
    customer: 'cus_000007269412',
    value: 50,
    netValue: 49.01,
    billingType: 'PIX',
    status: 'RECEIVED',
    externalReference: 'spike:pix-recebido',
  },
});

/** O Asaas "de verdade" deste teste: diz que a cobrança está só CONFIRMED, não RECEIVED. */
class FakeGateway implements Partial<PaymentGateway> {
  calls: string[] = [];
  failNext = false;

  getPayment(paymentId: string): Promise<Payment> {
    this.calls.push(`getPayment ${paymentId}`);
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('Asaas fora do ar'));
    }
    return Promise.resolve({
      id: paymentId,
      method: 'PIX',
      status: 'CONFIRMED',
      amountCents: 5000,
      netAmountCents: 4901,
      reference: 'spike:pix-recebido',
      dueDate: '2026-11-13',
      confirmedOn: '2026-11-13',
      receivedOn: null,
      expectedCreditOn: '2026-11-13',
      refunds: [],
      refundedAmountCents: 0,
    });
  }

  getTransfer(transferId: string): Promise<PixTransfer> {
    this.calls.push(`getTransfer ${transferId}`);
    return Promise.reject(new Error('não usado'));
  }
}

describe('US-016 — Os avisos do Asaas chegam com segurança', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let prisma: PrismaService;
  const gateway = new FakeGateway();
  const logs: string[] = [];

  const enviar = (body: object, token?: string) => {
    const req = request(app.getHttpServer()).post('/v1/webhooks/asaas').set('content-type', 'application/json');
    return (token === undefined ? req : req.set('asaas-access-token', token)).send(body);
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    app = await createApp({
      env: { ...process.env, DATABASE_URL: db.url, ASAAS_WEBHOOK_TOKEN: TOKEN, LOG_LEVEL: 'info' },
      paymentGateway: gateway as unknown as PaymentGateway,
      logStream: { write: (line: string) => void logs.push(line) },
    });
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  beforeEach(async () => {
    await prisma.asaasEvent.deleteMany();
    gateway.calls = [];
    logs.length = 0;
  });

  // Dado: um aviso sem o cabeçalho asaas-access-token, ou com um token diferente do configurado
  // Quando: ele chega em POST /v1/webhooks/asaas
  // Então: a resposta é 401 no formato padrão de erro
  // E: nada é gravado
  it('AC-040: aviso sem o token certo é recusado com 401 e nada é gravado @spec:AC-040', async () => {
    const semToken = await enviar(avisoDePagamento('evt_sem_token'));
    const tokenErrado = await enviar(avisoDePagamento('evt_token_errado'), `${TOKEN}-errado`);
    const tokenParecido = await enviar(avisoDePagamento('evt_token_curto'), TOKEN.slice(0, -1));

    for (const res of [semToken, tokenErrado, tokenParecido]) {
      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({ status: 401, requestId: expect.any(String) });
    }
    expect(await prisma.asaasEvent.count()).toBe(0);
    expect(gateway.calls).toEqual([]);
  });

  // Dado: um aviso de pagamento no formato documentado, com o id de um pagamento real do sandbox e o token certo
  // Quando: ele chega em POST /v1/webhooks/asaas
  // Então: o evento é registrado uma vez (pelo id do evento do Asaas) e respondido com 200
  // E: o estado do pagamento é buscado na API do Asaas, e não lido do conteúdo do aviso
  it('AC-041: aviso de pagamento é registrado e o estado vem da API do Asaas @spec:AC-041', async () => {
    const res = await enviar(avisoDePagamento('evt_05b708f961d739ea7eba7e4db318f621&368604920'), TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    const eventos = await prisma.asaasEvent.findMany();
    expect(eventos).toEqual([
      expect.objectContaining({
        id: 'evt_05b708f961d739ea7eba7e4db318f621&368604920',
        type: 'PAYMENT_RECEIVED',
        processedAt: expect.any(Date),
      }),
    ]);
    expect(gateway.calls).toEqual([`getPayment ${PAGAMENTO_SANDBOX}`]);
    // O aviso dizia RECEIVED; vale o que a API respondeu (CONFIRMED).
    const processado = logs.map((line) => JSON.parse(line) as Record<string, unknown>).find((l) => l.msg === 'aviso do Asaas processado');
    expect(processado).toMatchObject({ resourceId: PAGAMENTO_SANDBOX, status: 'CONFIRMED' });
  });

  // Dado: um aviso já processado
  // Quando: o Asaas manda o mesmo aviso de novo
  // Então: a resposta é 200
  // E: o evento não é processado nem consultado na API de novo
  it('AC-042: aviso repetido responde 200 sem processar nem consultar de novo @spec:AC-042', async () => {
    const aviso = avisoDePagamento('evt_repetido_0001');
    const primeiro = await enviar(aviso, TOKEN);
    const [gravado] = await prisma.asaasEvent.findMany();
    const segundo = await enviar(aviso, TOKEN);
    const terceiro = await enviar(aviso, TOKEN);

    expect([primeiro.status, segundo.status, terceiro.status]).toEqual([200, 200, 200]);
    expect(gateway.calls).toEqual([`getPayment ${PAGAMENTO_SANDBOX}`]);
    expect(await prisma.asaasEvent.findMany()).toEqual([gravado]);
  });

  it('aviso que falhou no meio é refeito quando o Asaas reenvia', async () => {
    const aviso = avisoDePagamento('evt_falhou_no_meio');
    gateway.failNext = true;

    const falhou = await enviar(aviso, TOKEN);
    const pendente = await prisma.asaasEvent.findUniqueOrThrow({ where: { id: aviso.id } });
    const reenviado = await enviar(aviso, TOKEN);
    const processado = await prisma.asaasEvent.findUniqueOrThrow({ where: { id: aviso.id } });

    // 500 faz o Asaas reenviar; a linha fica sem processed_at até dar certo.
    expect(falhou.status).toBe(500);
    expect(pendente.processedAt).toBeNull();
    expect(reenviado.status).toBe(200);
    expect(processado.processedAt).toEqual(expect.any(Date));
    expect(gateway.calls).toHaveLength(2);
  });

  it('aviso com token certo mas fora do formato é recusado com 400', async () => {
    const res = await enviar({ event: 'PAYMENT_RECEIVED' }, TOKEN);

    expect(res.status).toBe(400);
    expect(await prisma.asaasEvent.count()).toBe(0);
  });
});

describe('US-016 — Sem token configurado, nenhum aviso entra', () => {
  let db: TestDatabase;
  let app: INestApplication;

  beforeAll(async () => {
    db = await startTestDatabase();
    const env: Record<string, string | undefined> = { ...process.env, DATABASE_URL: db.url };
    delete env.ASAAS_WEBHOOK_TOKEN;
    app = await createApp({ env, paymentGateway: new FakeGateway() as unknown as PaymentGateway });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  it('com ASAAS_WEBHOOK_TOKEN vazio, recusa até aviso com token vazio', async () => {
    const vazio = await request(app.getHttpServer())
      .post('/v1/webhooks/asaas')
      .set('asaas-access-token', '')
      .send(avisoDePagamento('evt_sem_config'));
    const qualquer = await request(app.getHttpServer())
      .post('/v1/webhooks/asaas')
      .set('asaas-access-token', 'qualquer')
      .send(avisoDePagamento('evt_sem_config_2'));

    expect([vazio.status, qualquer.status]).toEqual([401, 401]);
    expect(await app.get(PrismaService).asaasEvent.count()).toBe(0);
  });
});
