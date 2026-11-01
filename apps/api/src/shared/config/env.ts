import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // true: o processo HTTP também consome as filas (demo, ADR-0010); false: só enfileira.
  RUN_WORKER: z.stringbool().default(true),
});

export type Env = z.infer<typeof envSchema>;

export class InvalidEnvError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `Configuração inválida — confira estas variáveis de ambiente: ${problems.join(', ')}. ` +
        'Veja o .env.example na raiz do projeto.',
    );
    this.name = 'InvalidEnvError';
  }
}

// Valida as variáveis na subida. A mensagem cita só nomes, nunca valores (AC-015).
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  const problems = names.map((name) => `${name} (${source[name] === undefined ? 'ausente' : 'inválida'})`);
  throw new InvalidEnvError(problems);
}
