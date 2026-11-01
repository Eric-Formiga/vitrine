import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/create-app.js';
import type { ClerkGateway } from '../src/modules/identity/application/clerk-gateway.port.js';
import type { ClerkProfile } from '../src/modules/identity/domain/user.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { sessionToken, TEST_JWT_PUBLIC_KEY, TEST_WEB_ORIGIN } from './support/clerk-test-kit.js';
import { startTestDatabase, type TestDatabase } from './support/postgres-container.js';

// Clerk de mentira: responde com os perfis cadastrados aqui.
class FakeClerkGateway implements ClerkGateway {
  readonly profiles = new Map<string, ClerkProfile>();
  calls = 0;

  async fetchProfile(clerkId: string): Promise<ClerkProfile | null> {
    this.calls += 1;
    return this.profiles.get(clerkId) ?? null;
  }
}

describe('US-002 e US-003 — Login na API', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let prisma: PrismaService;
  const clerk = new FakeClerkGateway();

  const me = (token?: string) => {
    const req = request(app.getHttpServer()).get('/v1/me');
    return token ? req.set('authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    app = await createApp({
      env: {
        ...process.env,
        DATABASE_URL: db.url,
        CLERK_JWT_KEY: TEST_JWT_PUBLIC_KEY,
        CLERK_AUTHORIZED_PARTIES: TEST_WEB_ORIGIN,
      },
      clerkGateway: clerk,
    });
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
    await db?.stop();
  });

  // Dado: uma requisição sem token, com token inválido ou com token expirado
  // Quando: ela chama uma rota privada (GET /v1/me)
  // Então: a resposta avisa que é preciso entrar (401, no formato padrão de erro)
  it('AC-007: sem token, a rota privada responde 401 no formato padrão @spec:AC-007', async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({ title: 'Unauthorized', status: 401 });
  });

  it('AC-007: token forjado, expirado ou de outra origem responde 401 @spec:AC-007', async () => {
    await prisma.user.create({ data: { clerkId: 'user_bia', email: 'bia@exemplo.com', name: 'Bia' } });
    const agora = Math.floor(Date.now() / 1000);

    const forjado = await me(sessionToken('user_bia', { forged: true }));
    const expirado = await me(sessionToken('user_bia', { claims: { iat: agora - 600, nbf: agora - 600, exp: agora - 300 } }));
    const outraOrigem = await me(sessionToken('user_bia', { claims: { azp: 'https://site-malicioso.com' } }));
    const lixo = await me('nao-e-um-jwt');

    for (const res of [forjado, expirado, outraOrigem, lixo]) expect(res.status).toBe(401);
  });

  // Dado: uma pessoa logada cujos papéis na Vitrine são diferentes dos que aparecem no token
  // Quando: ela abre o próprio perfil (GET /v1/me)
  // Então: vê id, nome, e-mail e os papéis guardados na Vitrine (o banco é a fonte de verdade)
  it('AC-008: o perfil mostra os papéis do banco, nunca os do token @spec:AC-008', async () => {
    const user = await prisma.user.create({
      data: { clerkId: 'user_caio', email: 'caio@exemplo.com', name: 'Caio Lima', roles: ['customer', 'seller'] },
    });
    const tokenComPapelFalso = sessionToken('user_caio', { claims: { metadata: { roles: ['admin'] } } });

    const res = await me(tokenComPapelFalso);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: user.id,
      email: 'caio@exemplo.com',
      name: 'Caio Lima',
      roles: ['customer', 'seller'],
    });
  });

  // Dado: uma pessoa logada (token válido do Clerk) que ainda não existe na tabela de usuários
  // Quando: ela abre o próprio perfil (GET /v1/me)
  // Então: a Vitrine busca os dados dela no Clerk e a cadastra como compradora
  // E: o perfil aparece normalmente (200)
  it('AC-006: quem ainda não está no banco é cadastrado no primeiro acesso @spec:AC-006', async () => {
    clerk.profiles.set('user_davi', { clerkId: 'user_davi', email: 'davi@exemplo.com', name: 'Davi Rocha', phone: null });

    const res = await me(sessionToken('user_davi'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'davi@exemplo.com', name: 'Davi Rocha', roles: ['customer'] });
    const gravado = await prisma.user.findUniqueOrThrow({ where: { clerkId: 'user_davi' } });
    expect(gravado.id).toBe(res.body.id);
  });

  it('token válido de alguém que nem o Clerk conhece responde 401', async () => {
    const res = await me(sessionToken('user_fantasma'));

    expect(res.status).toBe(401);
  });

  it('conta excluída (anonimizada) não entra, mesmo com token ainda válido', async () => {
    await prisma.user.create({
      data: { clerkId: 'user_eva', email: 'excluido+user_eva@anonimo.invalid', name: 'Conta excluída', deletedAt: new Date() },
    });

    const res = await me(sessionToken('user_eva'));

    expect(res.status).toBe(401);
  });

  it('rotas públicas continuam abertas sem token', async () => {
    const health = await request(app.getHttpServer()).get('/health/live');
    const webhook = await request(app.getHttpServer()).post('/v1/webhooks/clerk').send({});

    expect(health.status).toBe(200);
    expect(webhook.status).toBe(400); // barrado pela assinatura do aviso, não pelo login
  });
});
