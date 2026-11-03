import { randomUUID } from 'node:crypto';

import { Get, Module, Param, Post } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditTrail } from '../src/shared/audit/audit-trail.js';
import { Audited } from '../src/shared/audit/audited.decorator.js';
import { AdminController } from '../src/shared/auth/roles.decorator.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { createPerson, startTestApp, type TestApp, type TestPerson } from './support/admin-test-kit.js';

// Área de admin de mentira: as rotas reais (categorias) chegam na T-008.
@AdminController('teste')
class TestAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trail: AuditTrail,
  ) {}

  @Get()
  list() {
    return { ok: true };
  }

  @Post('itens/:id')
  @Audited('item.update')
  async update(@Param('id') id: string) {
    await this.prisma.$transaction((tx) =>
      this.trail.record(tx, { entityType: 'item', entityId: id, before: { nome: 'antes' }, after: { nome: 'depois' } }),
    );
    return { ok: true };
  }

  @Post('itens/:id/falha')
  @Audited('item.update')
  async failAfterRecording(@Param('id') id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.trail.record(tx, { entityType: 'item', entityId: id, before: null, after: { nome: 'x' } });
      throw new Error('falha no meio da transação');
    });
  }
}

@Module({ controllers: [TestAdminController] })
class TestAdminModule {}

describe('US-010 e US-013 — Área de admin e auditoria', () => {
  let t: TestApp;
  let admin: TestPerson;
  let customer: TestPerson;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await startTestApp([TestAdminModule]);
    admin = await createPerson(t.prisma, 'Alice', ['customer', 'admin']);
    customer = await createPerson(t.prisma, 'Bruno', ['customer', 'seller']);
  });

  afterAll(async () => {
    await t?.close();
  });

  // Dado: uma pessoa logada sem o papel admin
  // Quando: ela chama qualquer rota de administração (/v1/admin/...)
  // Então: a resposta é a mesma de uma rota que não existe (404, no formato padrão de erro)
  // E: sem login, a resposta continua sendo "é preciso entrar" (401)
  it('AC-021: quem não é admin recebe o mesmo 404 de uma rota inexistente @spec:AC-021', async () => {
    const protegida = await http().get('/v1/admin/teste').set('authorization', customer.auth);
    const inexistente = await http().get('/v1/admin/nao-existe').set('authorization', customer.auth);
    const escrita = await http().post(`/v1/admin/teste/itens/${randomUUID()}`).set('authorization', customer.auth);

    for (const res of [protegida, inexistente, escrita]) {
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(res.body).toMatchObject({ type: 'about:blank', title: 'Not Found', status: 404 });
    }
    expect(protegida.body.detail).toBe('Cannot GET /v1/admin/teste');
    expect(inexistente.body.detail).toBe('Cannot GET /v1/admin/nao-existe');
  });

  it('AC-021: sem login, a área de admin pede para entrar (401) @spec:AC-021', async () => {
    const res = await http().get('/v1/admin/teste');

    expect(res.status).toBe(401);
  });

  // Dado: uma pessoa logada com o papel admin guardado no banco
  // Quando: ela chama uma rota de administração
  // Então: a rota responde normalmente (200)
  it('AC-022: admin entra na área de admin @spec:AC-022', async () => {
    const res = await http().get('/v1/admin/teste').set('authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('escrita auditada grava autor, ação, entidade, antes, depois e IP', async () => {
    const id = randomUUID();

    const res = await http().post(`/v1/admin/teste/itens/${id}`).set('authorization', admin.auth);

    expect(res.status).toBe(201);
    const logs = await t.prisma.auditLog.findMany({ where: { entityId: id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorUserId: admin.id,
      action: 'item.update',
      entityType: 'item',
      before: { nome: 'antes' },
      after: { nome: 'depois' },
    });
    expect(logs[0]?.ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('escrita que falha no meio desfaz também o registro de auditoria', async () => {
    const id = randomUUID();

    const res = await http().post(`/v1/admin/teste/itens/${id}/falha`).set('authorization', admin.auth);

    expect(res.status).toBe(500);
    expect(await t.prisma.auditLog.count({ where: { entityId: id } })).toBe(0);
  });

  it('leituras e acessos barrados não geram registro', async () => {
    const antes = await t.prisma.auditLog.count();

    await http().get('/v1/admin/teste').set('authorization', admin.auth);
    await http().post(`/v1/admin/teste/itens/${randomUUID()}`).set('authorization', customer.auth);

    expect(await t.prisma.auditLog.count()).toBe(antes);
  });
});
