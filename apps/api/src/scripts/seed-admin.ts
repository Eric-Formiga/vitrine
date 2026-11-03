import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { AccountNotFoundError, GrantAdminUseCase } from '../modules/identity/application/grant-admin.use-case.js';
import { PrismaUserRepository } from '../modules/identity/infra/prisma-user.repository.js';
import { PrismaService } from '../shared/prisma/prisma.service.js';

// pnpm seed:admin --email ana@exemplo.com
// Torna admin uma conta que já existe na Vitrine (a pessoa precisa ter entrado no site antes).

export interface SeedAdminIo {
  out: (message: string) => void;
  err: (message: string) => void;
}

const USAGE = 'Uso: pnpm seed:admin --email <e-mail>';

/** Executa o seed e devolve o código de saída do processo (0 = deu certo). */
export async function seedAdmin(argv: string[], databaseUrl: string | undefined, io: SeedAdminIo): Promise<number> {
  const email = emailFrom(argv);
  if (!email) {
    io.err(USAGE);
    return 2;
  }
  if (!databaseUrl) {
    io.err('Variável de ambiente ausente: DATABASE_URL. Veja o .env.example na raiz do projeto.');
    return 1;
  }

  const prisma = new PrismaService({ DATABASE_URL: databaseUrl });
  try {
    const grantAdmin = new GrantAdminUseCase(new PrismaUserRepository(prisma));
    const { alreadyAdmin } = await grantAdmin.execute(email);
    io.out(
      alreadyAdmin
        ? `${email} já era admin. Nada mudou.`
        : `${email} agora é admin. Com a API rodando, o acesso vale em até 1 minuto.`,
    );
    return 0;
  } catch (error) {
    if (!(error instanceof AccountNotFoundError)) throw error;
    io.err(error.message);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

// Aceita "--email x" e "--email=x".
function emailFrom(argv: string[]): string | undefined {
  for (const [i, arg] of argv.entries()) {
    const value = arg === '--email' ? argv[i + 1] : arg.startsWith('--email=') ? arg.slice('--email='.length) : null;
    if (value === null) continue;
    return value && !value.startsWith('--') ? value.trim() : undefined;
  }
  return undefined;
}

// Rodando como comando (node dist/scripts/seed-admin.js), e não importado pelos testes.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (!process.env.DATABASE_URL && existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  process.exitCode = await seedAdmin(process.argv.slice(2), process.env.DATABASE_URL, {
    out: (message) => console.log(message),
    err: (message) => console.error(message),
  });
}
