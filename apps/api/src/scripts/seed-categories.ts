import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { Prisma } from '../generated/prisma/client.js';
import type { SizeType } from '../modules/catalog/domain/category.js';
import type { SizeChart } from '../modules/catalog/domain/size-chart.js';
import { PrismaService } from '../shared/prisma/prisma.service.js';

// pnpm db:seed — cria a árvore inicial de moda (AC-024). Só cria o que falta: categoria
// que já existe (pelo slug) não é tocada, nem se o admin a editou ou arquivou depois.

// ── Guias de medidas ──────────────────────────────────────────────────────────

const CLOTHING_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XGG'];

const WOMEN_CHART: SizeChart = {
  columns: ['Tamanho', 'Busto (cm)', 'Cintura (cm)', 'Quadril (cm)'],
  rows: CLOTHING_SIZES.map((size, i) => [size, String(82 + i * 5), String(64 + i * 5), String(88 + i * 5)]),
};

const MEN_CHART: SizeChart = {
  columns: ['Tamanho', 'Tórax (cm)', 'Cintura (cm)'],
  rows: CLOTHING_SIZES.map((size, i) => [size, String(88 + i * 6), String(72 + i * 6)]),
};

// Numeração brasileira 33 a 46; comprimento do pé ≈ número × 2/3 − 1 cm, arredondado a 0,5.
const SHOES_CHART: SizeChart = {
  columns: ['Número', 'Comprimento do pé (cm)'],
  rows: Array.from({ length: 14 }, (_, i) => {
    const size = 33 + i;
    const foot = Math.round(((size * 2) / 3 - 1) * 2) / 2;
    return [String(size), foot.toFixed(1).replace('.', ',')];
  }),
};

// ── Árvore ────────────────────────────────────────────────────────────────────

interface Department {
  name: string;
  slug: string;
  sizeType: SizeType;
  sizeChart: SizeChart | null;
  /** [nome, slug] — slugs explícitos e únicos na árvore inteira (ASM-006). */
  children: [string, string][];
}

export const FASHION_TREE: Department[] = [
  {
    name: 'Feminino',
    slug: 'feminino',
    sizeType: 'CLOTHING',
    sizeChart: WOMEN_CHART,
    children: [
      ['Vestidos', 'vestidos-femininos'],
      ['Blusas e Camisas', 'blusas-femininas'],
      ['Calças', 'calcas-femininas'],
      ['Saias', 'saias'],
      ['Shorts', 'shorts-femininos'],
      ['Casacos e Jaquetas', 'casacos-femininos'],
      ['Moda Praia', 'moda-praia-feminina'],
    ],
  },
  {
    name: 'Masculino',
    slug: 'masculino',
    sizeType: 'CLOTHING',
    sizeChart: MEN_CHART,
    children: [
      ['Camisetas', 'camisetas-masculinas'],
      ['Camisas', 'camisas-masculinas'],
      ['Calças', 'calcas-masculinas'],
      ['Bermudas', 'bermudas-masculinas'],
      ['Casacos e Jaquetas', 'casacos-masculinos'],
    ],
  },
  {
    name: 'Calçados',
    slug: 'calcados',
    sizeType: 'SHOES',
    sizeChart: SHOES_CHART,
    children: [
      ['Tênis', 'tenis'],
      ['Sandálias', 'sandalias'],
      ['Botas', 'botas'],
      ['Sapatos', 'sapatos'],
    ],
  },
  {
    name: 'Acessórios',
    slug: 'acessorios',
    sizeType: 'ONE_SIZE',
    sizeChart: null,
    children: [
      ['Bolsas', 'bolsas'],
      ['Cintos', 'cintos'],
      ['Óculos', 'oculos'],
      ['Bijuterias', 'bijuterias'],
      ['Bonés e Chapéus', 'bones-e-chapeus'],
    ],
  },
];

export interface SeedResult {
  created: number;
  existing: number;
}

type Db = Pick<PrismaService, 'category'>;

export async function seedCategories(prisma: Db): Promise<SeedResult> {
  const result: SeedResult = { created: 0, existing: 0 };

  // Cria se faltar e devolve o id; o que já existe fica como está.
  const ensure = async (data: {
    name: string;
    slug: string;
    position: number;
    parentId: string | null;
    sizeType: SizeType;
    sizeChart: SizeChart | null;
  }): Promise<string> => {
    const found = await prisma.category.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (found) {
      result.existing += 1;
      return found.id;
    }
    const created = await prisma.category.create({
      data: { ...data, sizeChart: (data.sizeChart ?? undefined) as Prisma.InputJsonValue | undefined },
      select: { id: true },
    });
    result.created += 1;
    return created.id;
  };

  for (const [position, dep] of FASHION_TREE.entries()) {
    const { name, slug, sizeType, sizeChart } = dep;
    const parentId = await ensure({ name, slug, sizeType, sizeChart, position, parentId: null });
    for (const [childPosition, [name, slug]] of dep.children.entries()) {
      await ensure({ name, slug, position: childPosition, parentId, sizeType: dep.sizeType, sizeChart: dep.sizeChart });
    }
  }
  return result;
}

// Rodando como comando (node dist/scripts/seed-categories.js), e não importado pelos testes.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootEnvFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (!process.env.DATABASE_URL && existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  if (!process.env.DATABASE_URL) {
    console.error('Variável de ambiente ausente: DATABASE_URL. Veja o .env.example na raiz do projeto.');
    process.exitCode = 1;
  } else {
    const prisma = new PrismaService({ DATABASE_URL: process.env.DATABASE_URL });
    try {
      const { created, existing } = await seedCategories(prisma);
      console.log(`Categorias: ${created} criada(s), ${existing} já existia(m).`);
    } finally {
      await prisma.$disconnect();
    }
  }
}
