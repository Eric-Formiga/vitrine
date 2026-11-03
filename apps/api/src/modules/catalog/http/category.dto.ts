import { z } from 'zod';

import { type Category, type CategoryNode, SIZE_TYPES } from '../domain/category.js';
import { isRectangular } from '../domain/size-chart.js';
import { SLUG_PATTERN } from '../domain/slugify.js';

// ── Entrada ───────────────────────────────────────────────────────────────────

const cell = z.string().trim().max(40);

export const sizeChartSchema = z
  .object({
    columns: z.array(cell.min(1)).min(1).max(12),
    rows: z.array(z.array(cell)).max(60),
  })
  .strict()
  .refine(isRectangular, { message: 'Cada linha precisa ter o mesmo número de colunas.', path: ['rows'] });

const fields = {
  name: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.').max(80),
  slug: z
    .string()
    .max(80)
    .regex(SLUG_PATTERN, 'Use só letras minúsculas sem acento, números e hífens (ex.: vestidos-femininos).'),
  parentId: z.uuid('Informe o id de uma categoria.').nullable(),
  position: z.number().int().min(0).max(10_000),
  sizeType: z.enum(SIZE_TYPES, { error: 'Use CLOTHING, SHOES ou ONE_SIZE.' }),
  sizeChart: sizeChartSchema.nullable(),
};

export const createCategorySchema = z
  .object({
    name: fields.name,
    sizeType: fields.sizeType,
    slug: fields.slug.optional(),
    parentId: fields.parentId.optional(),
    position: fields.position.optional(),
    sizeChart: fields.sizeChart.optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: fields.name.optional(),
    sizeType: fields.sizeType.optional(),
    slug: fields.slug.optional(),
    parentId: fields.parentId.optional(),
    position: fields.position.optional(),
    sizeChart: fields.sizeChart.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Informe ao menos um campo para alterar.' });

export type CreateCategoryBody = z.output<typeof createCategorySchema>;
export type UpdateCategoryBody = z.output<typeof updateCategorySchema>;

// ── Saída ─────────────────────────────────────────────────────────────────────

/** Nó da árvore pública: só o que o site precisa. */
export interface PublicCategoryNode {
  id: string;
  name: string;
  slug: string;
  sizeType: Category['sizeType'];
  sizeChart: Category['sizeChart'];
  children: PublicCategoryNode[];
}

export type AdminCategory = Omit<Category, 'archivedAt'> & { archivedAt: string | null };
export type AdminCategoryNode = AdminCategory & { children: AdminCategoryNode[] };

export function toPublicNode(node: CategoryNode): PublicCategoryNode {
  const { id, name, slug, sizeType, sizeChart } = node;
  return { id, name, slug, sizeType, sizeChart, children: node.children.map(toPublicNode) };
}

export function toAdminCategory(category: Category): AdminCategory {
  const { id, parentId, name, slug, position, sizeType, sizeChart, archivedAt } = category;
  return { id, parentId, name, slug, position, sizeType, sizeChart, archivedAt: archivedAt?.toISOString() ?? null };
}

export function toAdminNode(node: CategoryNode): AdminCategoryNode {
  return { ...toAdminCategory(node), children: node.children.map(toAdminNode) };
}
