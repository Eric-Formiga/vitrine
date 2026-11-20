import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  CLEAN_ORPHAN_UPLOADS_CRON,
  CLEAN_ORPHAN_UPLOADS_QUEUE,
  CleanOrphanUploadsUseCase,
} from '../src/modules/media/application/clean-orphan-uploads.use-case.js';
import { startTestApp, type TestApp } from './support/admin-test-kit.js';
import { createCategory, createStore, type TestStore } from './support/product-test-kit.js';
import { FakeStorage } from './support/storage-test-kit.js';

const HORA = 60 * 60 * 1000;

describe('US-030 — As imagens enviadas e nunca usadas são apagadas', () => {
  let t: TestApp;
  let ana: TestStore;
  let produto: string;
  let limpeza: CleanOrphanUploadsUseCase;
  const storage = new FakeStorage();
  const agora = new Date();
  const ha = (horas: number) => new Date(agora.getTime() - horas * HORA);

  /** Um arquivo no Storage e no registro de uploads, com as datas pedidas. */
  const arquivo = async (nome: string, { criado, desligado = null }: { criado: Date; desligado?: Date | null }) => {
    const path = `sellers/${ana.sellerId}/${nome}.webp`;
    await t.prisma.upload.create({
      data: { path, sellerId: ana.sellerId, contentType: 'image/webp', sizeBytes: 1000, createdAt: criado, detachedAt: desligado },
    });
    storage.upload(path);
    return path;
  };
  const registrados = async () => (await t.prisma.upload.findMany({ select: { path: true }, orderBy: { path: 'asc' } })).map((u) => u.path);

  beforeAll(async () => {
    t = await startTestApp([], { storageGateway: storage });
    const vestidos = await createCategory(t.prisma, 'vestidos');
    ana = await createStore(t, 'Ana', vestidos);
    produto = (
      await t.prisma.product.create({
        data: { sellerId: ana.sellerId, categoryId: vestidos, title: 'Vestido', slug: 'vestido', description: '', condition: 'NEW' },
      })
    ).id;
    limpeza = t.app.get(CleanOrphanUploadsUseCase);
  });

  afterAll(async () => {
    await t?.close();
  });

  beforeEach(async () => {
    await t.prisma.productImage.deleteMany();
    await t.prisma.upload.deleteMany();
    storage.reset();
  });

  // Dado: um upload de 25 h nunca usado, um de 2 h nunca usado, uma imagem tirada de um
  //       produto há 25 h e uma imagem em uso
  // Quando: o job de limpeza roda
  // Então: os dois arquivos com mais de 24 h são apagados do Storage e do registro de uploads
  // E: o recente e o em uso ficam; se o Storage falhar, o arquivo fica para a próxima rodada
  it('AC-081: a limpeza apaga só os órfãos com mais de 24 horas @spec:AC-081 @spec:US-030', async () => {
    const velho = await arquivo('nunca-usado-25h', { criado: ha(25) });
    const recente = await arquivo('nunca-usado-2h', { criado: ha(2) });
    const tirado = await arquivo('tirado-ha-25h', { criado: ha(72), desligado: ha(25) });
    const tiradoAgora = await arquivo('tirado-ha-2h', { criado: ha(72), desligado: ha(2) });
    const emUso = await arquivo('em-uso', { criado: ha(72) });
    await t.prisma.productImage.create({ data: { productId: produto, path: emUso, position: 0 } });

    // Primeiro com o Storage fora do ar: nada sai do registro.
    storage.failRemove = true;
    expect(await limpeza.execute(agora)).toEqual({ removed: 0, pending: true });
    expect(await registrados()).toHaveLength(5);

    storage.failRemove = false;
    const resultado = await limpeza.execute(agora);

    expect(resultado).toEqual({ removed: 2, pending: false });
    expect(storage.removed.toSorted()).toEqual([velho, tirado].toSorted());
    expect(await registrados()).toEqual([emUso, recente, tiradoAgora].toSorted());
    expect([...storage.files.keys()].toSorted()).toEqual([emUso, recente, tiradoAgora].toSorted());
    // Rodar de novo não acha mais nada.
    expect(await limpeza.execute(agora)).toEqual({ removed: 0, pending: false });
  });

  it('apaga em lotes de até 100 arquivos', async () => {
    await t.prisma.upload.createMany({
      data: Array.from({ length: 150 }, (_, i) => ({
        path: `sellers/${ana.sellerId}/lote-${String(i).padStart(3, '0')}.webp`,
        sellerId: ana.sellerId,
        contentType: 'image/webp',
        sizeBytes: 1000,
        createdAt: ha(30),
      })),
    });

    expect(await limpeza.execute(agora)).toEqual({ removed: 150, pending: false });
    expect(storage.removeCalls.map((lote) => lote.length)).toEqual([100, 50]);
    expect(await t.prisma.upload.count()).toBe(0);
  });

  it('a limpeza fica agendada de hora em hora na fila', async () => {
    const [agendada] = await t.prisma.$queryRaw<{ name: string; cron: string; timezone: string }[]>`
      SELECT name, cron, timezone FROM pgboss.schedule WHERE name = ${CLEAN_ORPHAN_UPLOADS_QUEUE}`;
    expect(agendada).toEqual({ name: CLEAN_ORPHAN_UPLOADS_QUEUE, cron: CLEAN_ORPHAN_UPLOADS_CRON, timezone: 'America/Sao_Paulo' });
  });
});
