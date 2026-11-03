import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedCategories } from '../src/scripts/seed-categories.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';
import { startTestDatabase, type TestDatabase } from './support/postgres-container.js';

describe('US-011 — Seed da árvore inicial de moda', () => {
  let db: TestDatabase;
  let prisma: PrismaService;

  beforeAll(async () => {
    db = await startTestDatabase();
    prisma = new PrismaService({ DATABASE_URL: db.url });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.stop();
  });

  const snapshot = () => prisma.category.findMany({ orderBy: { slug: 'asc' } });

  // Dado: um banco sem categorias
  // Quando: o seed das categorias roda
  // Então: a árvore inicial de moda existe (Feminino, Masculino, Calçados e Acessórios, com subcategorias)
  it('AC-024: o seed cria os quatro departamentos com subcategorias, tipo de tamanho e guia @spec:AC-024', async () => {
    const result = await seedCategories(prisma);

    const raizes = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { position: 'asc' },
      include: { children: true },
    });
    expect(raizes.map((r) => r.name)).toEqual(['Feminino', 'Masculino', 'Calçados', 'Acessórios']);
    for (const raiz of raizes) expect(raiz.children.length).toBeGreaterThanOrEqual(3);

    const todas = await snapshot();
    expect(result).toEqual({ created: todas.length, existing: 0 });
    const porSlug = new Map(todas.map((c) => [c.slug, c]));
    expect(porSlug.get('vestidos-femininos')).toMatchObject({ sizeType: 'CLOTHING' });
    expect(porSlug.get('tenis')).toMatchObject({ sizeType: 'SHOES' });
    expect(porSlug.get('bolsas')).toMatchObject({ sizeType: 'ONE_SIZE', sizeChart: null });

    // Roupa e calçado têm guia de medidas, numa tabela retangular.
    for (const c of todas.filter((c) => c.sizeType !== 'ONE_SIZE')) {
      const guia = c.sizeChart as { columns: string[]; rows: string[][] } | null;
      expect(guia, c.slug).not.toBeNull();
      for (const linha of guia!.rows) expect(linha).toHaveLength(guia!.columns.length);
    }
    // Filhas herdam o tipo de tamanho do departamento.
    for (const raiz of raizes) for (const filha of raiz.children) expect(filha.sizeType).toBe(raiz.sizeType);
  });

  // E: rodar o seed de novo não duplica nada (cada categoria é identificada pelo slug)
  it('AC-024: rodar de novo não duplica nem desfaz o que o admin mudou @spec:AC-024', async () => {
    await prisma.category.update({ where: { slug: 'saias' }, data: { name: 'Saias e Saias-Calça', position: 99 } });
    await prisma.category.update({ where: { slug: 'botas' }, data: { archivedAt: new Date() } });
    const antes = await snapshot();

    const result = await seedCategories(prisma);

    expect(result).toEqual({ created: 0, existing: antes.length });
    expect(await snapshot()).toEqual(antes);
  });

  it('categoria que falta é recriada embaixo da pai certa', async () => {
    await prisma.category.delete({ where: { slug: 'bones-e-chapeus' } });

    await seedCategories(prisma);

    const recriada = await prisma.category.findUniqueOrThrow({ where: { slug: 'bones-e-chapeus' }, include: { parent: true } });
    expect(recriada.parent?.slug).toBe('acessorios');
  });
});
