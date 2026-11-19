import { z } from 'zod';

import {
  DESCRIPTION_MAX,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUSES,
  type Product,
  type ProductSummary,
  TITLE_MAX,
  TITLE_MIN,
} from '../domain/product.js';

// Formatos de entrada e saída das rotas de produtos do vendedor. Cada schema com
// .meta({ id }) vira um componente do contrato OpenAPI e um tipo do @vitrine/api-client.

// ── Entrada ───────────────────────────────────────────────────────────────────

const fields = {
  title: z
    .string({ error: 'Informe o título.' })
    .trim()
    .min(TITLE_MIN, `Use pelo menos ${TITLE_MIN} caracteres.`)
    .max(TITLE_MAX, `Use no máximo ${TITLE_MAX} caracteres.`),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, `Use no máximo ${DESCRIPTION_MAX} caracteres.`)
    .describe('Texto puro; as quebras de linha são mantidas.'),
  categoryId: z.uuid('Escolha uma categoria.').describe('Categoria ativa e sem subcategorias.'),
  condition: z.enum(PRODUCT_CONDITIONS, { error: 'Use NEW (novo) ou USED (usado).' }),
};

export const createProductSchema = z
  .object({
    title: fields.title,
    description: fields.description.optional().describe('Texto puro; as quebras de linha são mantidas. Padrão: vazia.'),
    categoryId: fields.categoryId,
    condition: fields.condition,
  })
  .strict()
  .meta({ id: 'ProductInput' });

export type CreateProductBody = z.output<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    title: fields.title.optional(),
    description: fields.description.optional(),
    categoryId: fields.categoryId.optional(),
    condition: fields.condition.optional(),
  })
  .strict()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Envie pelo menos um campo para alterar.',
  })
  .meta({ id: 'ProductChangesInput', description: 'Só os campos que mudam. Exige If-Match.' });

export type UpdateProductBody = z.output<typeof updateProductSchema>;

export const productStatusQuerySchema = z
  .enum(PRODUCT_STATUSES, { error: 'Use DRAFT, ACTIVE, SUSPENDED ou ARCHIVED.' })
  .optional();

// ── Saída ─────────────────────────────────────────────────────────────────────

const suspensionSchema = z
  .object({ reason: z.string(), suspendedAt: z.iso.datetime() })
  .nullable()
  .describe('Preenchido quando o admin suspendeu o produto.');

export const sellerProductSchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    categoryId: z.uuid(),
    condition: z.enum(PRODUCT_CONDITIONS),
    status: z.enum(PRODUCT_STATUSES),
    version: z.int().describe('A mesma do cabeçalho ETag; mande de volta em If-Match.'),
    minPriceCents: z.int().nullable().describe('Preço da variante ativa mais barata, em centavos.'),
    publishedAt: z.iso.datetime().nullable(),
    suspension: suspensionSchema,
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'SellerProduct' });

export type SellerProductResponse = z.output<typeof sellerProductSchema>;

export const adminProductSchema = sellerProductSchema
  .extend({ sellerId: z.uuid().describe('Loja dona do produto.') })
  .meta({ id: 'AdminProduct' });

export type AdminProductResponse = z.output<typeof adminProductSchema>;

export function toAdminProduct(product: Product): AdminProductResponse {
  return { ...toSellerProduct(product), sellerId: product.sellerId };
}

export const sellerProductSummarySchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    status: z.enum(PRODUCT_STATUSES),
    version: z.int(),
    coverUrl: z.string().nullable().describe('URL pública da capa (a imagem de posição 0).'),
    minPriceCents: z.int().nullable(),
    totalStock: z.int().describe('Soma do estoque das variantes ativas.'),
    suspension: suspensionSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'SellerProductSummary' });

export type SellerProductSummaryResponse = z.output<typeof sellerProductSummarySchema>;

export function toSellerProduct(product: Product): SellerProductResponse {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    categoryId: product.categoryId,
    condition: product.condition,
    status: product.status,
    version: product.version,
    minPriceCents: product.minPriceCents,
    publishedAt: iso(product.publishedAt),
    suspension: suspensionOf(product),
    archivedAt: iso(product.archivedAt),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

/** `publicUrl` transforma o caminho no Storage na URL da imagem (módulo media, T-022). */
export function toSellerProductSummary(
  summary: ProductSummary,
  publicUrl: (path: string) => string | null,
): SellerProductSummaryResponse {
  return {
    id: summary.id,
    slug: summary.slug,
    title: summary.title,
    status: summary.status,
    version: summary.version,
    coverUrl: summary.coverPath ? publicUrl(summary.coverPath) : null,
    minPriceCents: summary.minPriceCents,
    totalStock: summary.totalStock,
    suspension: suspensionOf(summary),
    createdAt: summary.createdAt.toISOString(),
    updatedAt: summary.updatedAt.toISOString(),
  };
}

function suspensionOf(product: Product): SellerProductResponse['suspension'] {
  return product.status === 'SUSPENDED' && product.suspendedAt
    ? { reason: product.suspensionReason ?? '', suspendedAt: product.suspendedAt.toISOString() }
    : null;
}

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}
