import { z } from 'zod';

import {
  COLOR_HEX_PATTERN,
  COLOR_NAME_MAX,
  GRID_MAX,
  PRICE_MAX_CENTS,
  SKU_MAX,
  SKU_PATTERN,
  STOCK_MAX,
  type StockChange,
  type Variant,
  WEIGHT_MAX_GRAMS,
  WEIGHT_MIN_GRAMS,
} from '../domain/variant.js';

// Formatos da grade de variantes e do ajuste de estoque. Os limites vêm do domínio; o que
// depende do produto (tamanhos da categoria, combinação repetida, preço "de") é conferido
// no caso de uso, com o mesmo formato de erro (`variants.2.size`).

// ── Entrada ───────────────────────────────────────────────────────────────────

const price = z
  .int('Use um valor inteiro em centavos.')
  .min(1, 'O preço precisa ser maior que zero.')
  .max(PRICE_MAX_CENTS, 'Use no máximo R$ 100.000,00.');

const variantInputSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .max(SKU_MAX, `Use no máximo ${SKU_MAX} caracteres.`)
      .regex(SKU_PATTERN, 'Use letras, números, ponto, hífen ou sublinhado.')
      .optional()
      .describe('Único entre as variantes ativas da loja; guardado em maiúsculas. Sem ele: SLUG-TAMANHO-COR.'),
    size: z
      .string({ error: 'Informe o tamanho.' })
      .trim()
      .toUpperCase()
      .min(1, 'Informe o tamanho.')
      .describe('Da grade do tipo da categoria: PP, P, M, G, GG, XGG; 33 a 46; ou U.'),
    color: z
      .string({ error: 'Informe a cor.' })
      .trim()
      .min(1, 'Informe a cor.')
      .max(COLOR_NAME_MAX, `Use no máximo ${COLOR_NAME_MAX} caracteres.`)
      .describe('Nome da cor, como o comprador vê. "Preto" e "preto" são a mesma.'),
    colorHex: z
      .string({ error: 'Informe o código da cor.' })
      .trim()
      .toUpperCase()
      .regex(COLOR_HEX_PATTERN, 'Use o formato #RRGGBB.'),
    priceCents: price,
    compareAtCents: price.nullable().optional().describe('Preço "de", riscado; maior que o preço.'),
    stock: z.int('Use um número inteiro.').min(0, 'O estoque não pode ser negativo.').max(STOCK_MAX, `Use no máximo ${STOCK_MAX}.`),
    weightGrams: z
      .int('Use um número inteiro de gramas.')
      .min(WEIGHT_MIN_GRAMS, 'O peso precisa ser de pelo menos 1 g.')
      .max(WEIGHT_MAX_GRAMS, 'Use no máximo 30 kg.'),
  })
  .strict()
  .meta({ id: 'VariantInput' });

export const variantGridSchema = z
  .object({ variants: z.array(variantInputSchema).max(GRID_MAX, `Use no máximo ${GRID_MAX} variantes.`) })
  .strict()
  .meta({
    id: 'VariantGridInput',
    description: 'A grade inteira: quem não vier é arquivada. Exige If-Match.',
  });

export type VariantGridBody = z.output<typeof variantGridSchema>;

export const stockAdjustmentSchema = z
  .object({
    delta: z.int().min(-STOCK_MAX).max(STOCK_MAX).optional().describe('Soma ao estoque atual (negativo tira).'),
    absolute: z.int().min(0).max(STOCK_MAX).optional().describe('Novo estoque, no lugar do atual.'),
  })
  .strict()
  .refine((body) => (body.delta === undefined) !== (body.absolute === undefined), {
    message: 'Envie delta ou absolute, um dos dois.',
  })
  .meta({ id: 'StockAdjustmentInput' });

export type StockAdjustmentBody = z.output<typeof stockAdjustmentSchema>;

export function toStockChange(body: StockAdjustmentBody): StockChange {
  return body.delta === undefined ? { absolute: body.absolute ?? 0 } : { delta: body.delta };
}

// ── Saída ─────────────────────────────────────────────────────────────────────

export const sellerVariantSchema = z
  .object({
    id: z.uuid(),
    sku: z.string(),
    size: z.string(),
    color: z.string(),
    colorHex: z.string(),
    priceCents: z.int(),
    compareAtCents: z.int().nullable(),
    stock: z.int(),
    reserved: z.int().describe('Presas a checkouts em andamento; o estoque nunca fica abaixo disso.'),
    weightGrams: z.int(),
  })
  .meta({ id: 'SellerVariant' });

export const sellerVariantGridSchema = z
  .object({ variants: z.array(sellerVariantSchema).describe('As ativas, na ordem da grade de tamanhos.') })
  .meta({ id: 'SellerVariantGrid' });

export type SellerVariantGridResponse = z.output<typeof sellerVariantGridSchema>;

export const variantStockSchema = z.object({ id: z.uuid(), stock: z.int() }).meta({ id: 'VariantStock' });

export type VariantStockResponse = z.output<typeof variantStockSchema>;

export function toSellerVariantGrid(variants: readonly Variant[]): SellerVariantGridResponse {
  return {
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      colorHex: variant.colorHex,
      priceCents: variant.priceCents,
      compareAtCents: variant.compareAtCents,
      stock: variant.stock,
      reserved: variant.reserved,
      weightGrams: variant.weightGrams,
    })),
  };
}
