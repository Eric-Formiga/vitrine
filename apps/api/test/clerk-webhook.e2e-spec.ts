import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/create-app.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { clerkUser, type SignedEvent, signedEvent } from './support/clerk-test-kit.js';
import { startTestDatabase, type TestDatabase } from './support/postgres-container.js';

describe('US-001 — Quem cria conta passa a existir na Vitrine', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let prisma: PrismaService;

  const enviar = (event: SignedEvent) =>
    request(app.getHttpServer())
      .post('/v1/webhooks/clerk')
      .set(event.headers)
      .set('content-type', 'application/json')
      .send(event.body);

  beforeAll(async () => {
    db = await startTestDatabase();
    app = await createApp({ env: { ...process.env, DATABASE_URL: db.url } });
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  // Dado: que uma pessoa acabou de criar a conta no Clerk
  // Quando: o Clerk avisa a Vitrine (user.created com assinatura Svix válida)
  // Então: a pessoa passa a existir como compradora, com nome e e-mail do Clerk
  // E: o aviso é aceito (200)
  it('AC-001: conta nova no Clerk vira usuário da Vitrine @spec:AC-001', async () => {
    const res = await enviar(signedEvent('user.created', clerkUser({ phone: '+5511999990000' })));

    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: 'user_ana' } });
    expect(user).toMatchObject({
      email: 'ana@exemplo.com',
      name: 'Ana Souza',
      phone: '+5511999990000',
      roles: ['customer'],
      deletedAt: null,
    });
  });

  // Dado: um aviso com assinatura inválida ou sem assinatura
  // Quando: ele chega ao endereço de avisos do Clerk
  // Então: ele é recusado (400)
  // E: nenhum usuário é criado ou alterado
  it('AC-002: aviso com assinatura inválida é recusado sem gravar nada @spec:AC-002', async () => {
    const legitimo = signedEvent('user.created', clerkUser());
    const adulterado = { ...legitimo, body: legitimo.body.replace('ana@exemplo.com', 'invasor@exemplo.com') };

    const res = await enviar(adulterado);

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(await prisma.user.count()).toBe(0);
  });

  it('AC-002: aviso sem assinatura é recusado sem gravar nada @spec:AC-002', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/clerk')
      .set('content-type', 'application/json')
      .send(signedEvent('user.created', clerkUser()).body);

    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  // Dado: que a pessoa já existe na Vitrine
  // Quando: o Clerk envia de novo o aviso de criação dela
  // Então: continua existindo uma única pessoa (gravação idempotente por clerk_id)
  // E: o aviso é aceito (200)
  it('AC-003: aviso repetido não duplica a pessoa @spec:AC-003', async () => {
    const aviso = signedEvent('user.created', clerkUser());

    expect((await enviar(aviso)).status).toBe(200);
    expect((await enviar(aviso)).status).toBe(200);

    expect(await prisma.user.count()).toBe(1);
  });

  it('AC-003: reenvio do aviso de criação não apaga papéis já concedidos @spec:AC-003', async () => {
    await enviar(signedEvent('user.created', clerkUser()));
    await prisma.user.update({ where: { clerkId: 'user_ana' }, data: { roles: ['customer', 'seller'] } });

    await enviar(signedEvent('user.created', clerkUser()));

    const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: 'user_ana' } });
    expect(user.roles).toEqual(['customer', 'seller']);
  });

  // Dado: uma pessoa já cadastrada
  // Quando: ela muda o nome ou o e-mail no Clerk (user.updated)
  // Então: o perfil dela na Vitrine passa a ter o nome e o e-mail novos
  it('AC-004: nome e e-mail alterados no Clerk são atualizados na Vitrine @spec:AC-004', async () => {
    await enviar(signedEvent('user.created', clerkUser()));

    const res = await enviar(
      signedEvent('user.updated', clerkUser({ firstName: 'Ana Paula', email: 'ana.paula@exemplo.com' })),
    );

    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: 'user_ana' } });
    expect(user).toMatchObject({ name: 'Ana Paula Souza', email: 'ana.paula@exemplo.com' });
  });

  it('aviso de atualização que chega antes do de criação cria a pessoa (ordem não importa)', async () => {
    await enviar(signedEvent('user.updated', clerkUser()));

    expect(await prisma.user.count()).toBe(1);
  });

  // Dado: uma pessoa já cadastrada
  // Quando: ela exclui a conta no Clerk (user.deleted)
  // Então: nome, e-mail e telefone são trocados por valores anônimos e ela fica marcada como excluída
  // E: o registro continua no banco
  it('AC-005: conta excluída é anonimizada, nunca apagada @spec:AC-005', async () => {
    await enviar(signedEvent('user.created', clerkUser({ phone: '+5511999990000' })));

    const res = await enviar(signedEvent('user.deleted', { id: 'user_ana', object: 'user', deleted: true }));

    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: 'user_ana' } });
    expect(user.deletedAt).toBeInstanceOf(Date);
    expect(user.name).toBe('Conta excluída');
    expect(user.phone).toBeNull();
    expect(user.email).toMatch(/@anonimo\.invalid$/);
    expect(JSON.stringify(user)).not.toContain('ana@exemplo.com');
  });

  it('conta anonimizada não volta a ter dados se chegar um aviso atrasado', async () => {
    await enviar(signedEvent('user.created', clerkUser()));
    await enviar(signedEvent('user.deleted', { id: 'user_ana', object: 'user', deleted: true }));

    await enviar(signedEvent('user.updated', clerkUser()));

    const user = await prisma.user.findUniqueOrThrow({ where: { clerkId: 'user_ana' } });
    expect(user.name).toBe('Conta excluída');
  });

  it('eventos que a Vitrine não usa são aceitos e ignorados', async () => {
    const res = await enviar(signedEvent('session.created', { id: 'sess_1' }));

    expect(res.status).toBe(200);
    expect(await prisma.user.count()).toBe(0);
  });
});
