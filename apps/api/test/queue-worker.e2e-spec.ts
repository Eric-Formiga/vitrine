import { setTimeout as sleep } from 'node:timers/promises';

import { Inject, Injectable, type INestApplication, Module, type OnModuleInit } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/create-app.js';
import { JOB_QUEUE, type JobQueue } from '../src/shared/queue/job-queue.port.js';
import { startTestDatabase, type TestDatabase } from './support/postgres-container.js';

// Estado observado pelos testes: o que os jobs fizeram.
const seen = { rapidos: [] as unknown[], lentosIniciados: 0, lentosTerminados: 0 };

@Injectable()
class JobsDeTeste implements OnModuleInit {
  constructor(@Inject(JOB_QUEUE) private readonly queue: JobQueue) {}

  onModuleInit(): void {
    this.queue.work('teste-rapido', async (data) => {
      seen.rapidos.push(data);
    });
    this.queue.work('teste-lento', async () => {
      seen.lentosIniciados += 1;
      await sleep(2000);
      seen.lentosTerminados += 1;
    });
  }
}

@Module({ providers: [JobsDeTeste] })
class JobsDeTesteModule {}

async function waitFor(condition: () => boolean, timeoutMs = 15_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > end) throw new Error('condição não atingida a tempo');
    await sleep(100);
  }
}

describe('US-008 — Filas rodam junto com a API e desligam com segurança', () => {
  let db: TestDatabase;
  const abertas: INestApplication[] = [];

  async function subirApi(runWorker: boolean): Promise<INestApplication> {
    const app = await createApp({
      env: { ...process.env, DATABASE_URL: db.url, RUN_WORKER: String(runWorker) },
      imports: [JobsDeTesteModule],
    });
    abertas.push(app);
    return app;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
  });

  afterAll(async () => {
    for (const app of abertas) await app.close().catch(() => undefined);
    await db?.stop();
  });

  beforeEach(() => {
    seen.rapidos = [];
    seen.lentosIniciados = 0;
    seen.lentosTerminados = 0;
  });

  // Dado: a API iniciada com RUN_WORKER=true
  // Quando: um job é enfileirado
  // Então: o mesmo processo o executa
  it('AC-016: com RUN_WORKER=true a própria API executa o job @spec:AC-016', async () => {
    const app = await subirApi(true);
    await app.init();

    await app.get<JobQueue>(JOB_QUEUE).send('teste-rapido', { pedido: 1 });

    await waitFor(() => seen.rapidos.length === 1);
    expect(seen.rapidos).toEqual([{ pedido: 1 }]);
    await app.close();
  });

  // Dado: a API iniciada com RUN_WORKER=false
  // Quando: um job é enfileirado
  // Então: ele fica na fila sem ser executado (nenhum consumidor foi iniciado)
  it('AC-017: com RUN_WORKER=false a API só enfileira @spec:AC-017', async () => {
    const soEnfileira = await subirApi(false);
    await soEnfileira.init();

    await soEnfileira.get<JobQueue>(JOB_QUEUE).send('teste-rapido', { pedido: 2 });
    await sleep(3000);
    expect(seen.rapidos).toEqual([]);
    await soEnfileira.close();

    // A prova de que o job ficou guardado: um processo com worker o executa depois.
    const comWorker = await subirApi(true);
    await comWorker.init();
    await waitFor(() => seen.rapidos.length === 1);
    expect(seen.rapidos).toEqual([{ pedido: 2 }]);
    await comWorker.close();
  });

  // Dado: um job em execução
  // Quando: o processo recebe o sinal de desligamento (SIGTERM) — enableShutdownHooks chama app.close()
  // Então: a API para de aceitar requisições novas e espera o job terminar antes de encerrar
  it('AC-018: desligamento para de aceitar requisições e espera o job em andamento @spec:AC-018', async () => {
    const app = await subirApi(true);
    await app.listen(0);
    const server = app.getHttpServer() as { listening: boolean };

    await app.get<JobQueue>(JOB_QUEUE).send('teste-lento', {});
    await waitFor(() => seen.lentosIniciados === 1);

    const desligando = app.close();

    await waitFor(() => !server.listening, 5_000);
    expect(seen.lentosTerminados).toBe(0); // parou de aceitar requisições com o job ainda rodando

    await desligando;
    expect(seen.lentosTerminados).toBe(1); // só encerrou depois de o job terminar
  });
});
