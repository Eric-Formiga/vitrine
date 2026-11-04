import { z } from 'zod';

import { type Category, type CategoryNode, SIZE_TYPES } from '../domain/category.js';
import { isRectangular } from '../domain/size-chart.js';
import { SLUG_PATTERN } from '../domain/slugify.js';

// Formatos de entrada e saída das rotas de categorias. Cada schema com .meta({ id })
// vira um componente do contrato OpenAPI e um tipo do @vitrine/api-client (ADR-0008).

const cell = z.string().trim().max(40);

export const sizeChartSchema = z
  .object({
    columns: z.array(cell.min(1)).min(1).max(12),
    rows: z.array(z.array(cell)).max(60),
  })
  .strict()
  .refine(isRectangular, { message: 'Cada linha precisa ter o mesmo número de colunas.', path: ['rows'] })
  .meta({ id: 'SizeChart', description: 'Guia de medidas: cada linha tem o mesmo número de colunas.' });

const sizeTypeSchema = z
  .enum(SIZE_TYPES, { error: 'Use CLOTHING, SHOES ou ONE_SIZE.' })
  .describe('Grade de tamanhos: CLOTHING (PP–XGG), SHOES (33–46) ou ONE_SIZE (U).');

// ── Entrada ───────────────────────────────────────────────────────────────────

const fields = {
  name: z.string({ error: 'Informe o nome.' }).trim().min(1, 'Informe o nome.').max(80),
  slug: z
    .string()
    .max(80)
    .regex(SLUG_PATTERN, 'Use só letras minúsculas sem acento, números e hífens (ex.: vestidos-femininos).'),
  parentId: z.uuid('Informe o id de uma categoria.').nullable(),
  position: z.number().int().min(0).max(10_000),
  sizeType: sizeTypeSchema,
  sizeChart: sizeChartSchema.nullable(),
};

export const createCategorySchema = z
  .object({
    name: fields.name,
    sizeType: fields.sizeType,
    slug: fields.slug.optional().describe('Gerado do nome quando omitido.'),
    parentId: fields.parentId.optional().describe('Categoria pai; omitido ou null = primeiro nível.'),
    position: fields.position.optional().describe('Ordem entre as irmãs (padrão 0).'),
    sizeChart: fields.sizeChart.optional(),
  })
  .strict()
  .meta({ id: 'CreateCategory' });

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
  .refine((changes) => Object.keys(changes).length > 0, { message: 'Informe ao menos um campo para alterar.' })
  .meta({ id: 'UpdateCategory', description: 'Só os campos enviados mudam.' });

export type CreateCategoryBody = z.output<typeof createCategorySchema>;
export type UpdateCategoryBody = z.output<typeof updateCategorySchema>;

// ── Saída ─────────────────────────────────────────────────────────────────────

/** Nó da árvore pública: só o que o site precisa. */
export const publicCategoryNodeSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    sizeType: sizeTypeSchema,
    sizeChart: sizeChartSchema.nullable(),
    get children(): z.ZodArray<typeof publicCategoryNodeSchema> {
      return z.array(publicCategoryNodeSchema);
    },
  })
  .meta({ id: 'PublicCategoryNode' });

export const adminCategorySchema = z
  .object({
    id: z.uuid(),
    parentId: z.uuid().nullable(),
    name: z.string(),
    slug: z.string(),
    position: z.number().int(),
    sizeType: sizeTypeSchema,
    sizeChart: sizeChartSchema.nullable(),
    archivedAt: z.iso.datetime().nullable().describe('Preenchido quando a categoria está arquivada.'),
  })
  .meta({ id: 'AdminCategory' });

export const adminCategoryNodeSchema = adminCategorySchema
  .extend({
    get children(): z.ZodArray<typeof adminCategoryNodeSchema> {
      return z.array(adminCategoryNodeSchema);
    },
  })
  .meta({ id: 'AdminCategoryNode' });

export type PublicCategoryNode = z.output<typeof publicCategoryNodeSchema>;
export type AdminCategory = z.output<typeof adminCategorySchema>;
export type AdminCategoryNode = z.output<typeof adminCategoryNodeSchema>;

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
