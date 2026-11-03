import type { INestApplication, ModuleMetadata } from '@nestjs/common';

import { createApp } from '../../src/create-app.js';
import { PrismaService } from '../../src/shared/prisma/prisma.service.js';
import { sessionToken, TEST_JWT_PUBLIC_KEY, TEST_WEB_ORIGIN } from './clerk-test-kit.js';
import { startTestDatabase, type TestDatabase } from './postgres-container.js';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  db: TestDatabase;
  close: () => Promise<void>;
}

// API completa sobre um Postgres descartável, aceitando os tokens assinados pelo kit do Clerk.
export async function startTestApp(imports: ModuleMetadata['imports'] = []): Promise<TestApp> {
  const db = await startTestDatabase();
  const app = await createApp({
    env: {
      ...process.env,
      DATABASE_URL: db.url,
      CLERK_JWT_KEY: TEST_JWT_PUBLIC_KEY,
      CLERK_AUTHORIZED_PARTIES: TEST_WEB_ORIGIN,
    },
    imports,
  });
  await app.init();
  return {
    app,
    db,
    prisma: app.get(PrismaService),
    close: async () => {
      await app.close();
      await db.stop();
    },
  };
}

export interface TestPerson {
  id: string;
  clerkId: string;
  /** Cabeçalho Authorization pronto, com um token de sessão válido. */
  auth: string;
}

// Cadastra uma pessoa direto no banco, com os papéis pedidos, e devolve um token dela.
export async function createPerson(prisma: PrismaService, name: string, roles: string[] = ['customer']): Promise<TestPerson> {
  const clerkId = `user_${name.toLowerCase()}`;
  const user = await prisma.user.create({ data: { clerkId, email: `${name.toLowerCase()}@exemplo.com`, name, roles } });
  return { id: user.id, clerkId, auth: `Bearer ${sessionToken(clerkId)}` };
}
