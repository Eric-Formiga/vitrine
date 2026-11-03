import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedAdmin } from '../src/scripts/seed-admin.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { startTestDatabase, type TestDatabase } from './support/postgres-container.js';

describe('US-009 — Admin inicial pelo seed', () => {
  let db: TestDatabase;
  let prisma: PrismaClient;
  let out: string[];
  let err: string[];
  const io = { out: (m: string) => out.push(m), err: (m: string) => err.push(m) };
  const run = (...argv: string[]) => seedAdmin(argv, db.url, io);

  beforeAll(async () => {
    db = await startTestDatabase();
    prisma = new PrismaService({ DATABASE_URL: db.url });
    await prisma.user.createMany({
      data: [
        { clerkId: 'user_ana', email: 'ana@exemplo.com', name: 'Ana', roles: ['customer', 'seller'] },
        { clerkId: 'user_bia', email: 'bia@exemplo.com', name: 'Bia', roles: ['customer'] },
        {
          clerkId: 'user_eva',
          email: 'excluido+user_eva@anonimo.invalid',
          name: 'Conta excluída',
          roles: ['customer'],
          deletedAt: new Date(),
        },
      ],
    });
  });

  beforeEach(() => {
    out = [];
    err = [];
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.stop();
  });

  const rolesOf = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email } })).roles;
  const snapshot = () => prisma.user.findMany({ orderBy: { email: 'asc' }, select: { email: true, roles: true, updatedAt: true } });

  // Dado: uma pessoa já cadastrada na Vitrine com o e-mail ana@exemplo.com
  // Quando: alguém roda o seed do admin com esse e-mail
  // Então: ela passa a ter o papel admin, sem perder os papéis que já tinha
  // E: rodar o comando de novo não repete o papel
  it('AC-019: o seed torna a pessoa admin sem perder os outros papéis @spec:AC-019', async () => {
    const code = await run('--email', 'ana@exemplo.com');

    expect(code).toBe(0);
    expect(await rolesOf('ana@exemplo.com')).toEqual(['customer', 'seller', 'admin']);
    expect(out.join('\n')).toContain('ana@exemplo.com agora é admin');
  });

  it('AC-019: rodar de novo não repete o papel @spec:AC-019', async () => {
    await run('--email', 'bia@exemplo.com');
    const code = await run('--email=BIA@exemplo.com');

    expect(code).toBe(0);
    expect(await rolesOf('bia@exemplo.com')).toEqual(['customer', 'admin']);
    expect(out.at(-1)).toContain('já era admin');
  });

  // Dado: que nenhuma pessoa da Vitrine tem o e-mail informado (ou a conta foi excluída)
  // Quando: alguém roda o seed do admin com esse e-mail
  // Então: o comando termina com erro e diz que não achou a conta
  // E: nenhum usuário é alterado
  it('AC-020: e-mail desconhecido termina com erro e não muda ninguém @spec:AC-020', async () => {
    const antes = await snapshot();

    const desconhecido = await run('--email', 'ninguem@exemplo.com');
    const excluida = await run('--email', 'excluido+user_eva@anonimo.invalid');

    expect(desconhecido).toBe(1);
    expect(excluida).toBe(1);
    expect(err[0]).toContain('Nenhuma conta ativa da Vitrine tem o e-mail ninguem@exemplo.com');
    expect(await snapshot()).toEqual(antes);
  });

  it('sem --email, mostra como usar e não mexe no banco', async () => {
    const antes = await snapshot();

    expect(await run()).toBe(2);
    expect(await run('--email')).toBe(2);
    expect(err[0]).toContain('Uso: pnpm seed:admin --email');
    expect(await snapshot()).toEqual(antes);
  });
});
