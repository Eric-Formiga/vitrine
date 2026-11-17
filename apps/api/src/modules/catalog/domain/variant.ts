// Variantes do produto (tamanho × cor) e a troca da grade (spec 03 H1): regras puras, sem
// Nest nem banco (ADR-0002). Os limites numéricos daqui também viram o formato da entrada.
import type { FieldError } from '../../../shared/errors/domain-error.js';
import { slugify } from '../../../shared/text/slugify.js';
import type { SizeType } from './category.js';
import { sizeIndex, sizeListOf } from './size-grid.js';

/** R$ 100.000,00. */
export const PRICE_MAX_CENTS = 10_000_000;
export const STOCK_MAX = 99_999;
export const WEIGHT_MIN_GRAMS = 1;
export const WEIGHT_MAX_GRAMS = 30_000;
export const COLOR_NAME_MAX = 30;
// Os dois aceitam minúsculas na entrada; a API grava em maiúsculas.
export const COLOR_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
export const SKU_MAX = 120;
export const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** Combinações por produto: 6 tamanhos de roupa × 16 cores ainda cabem. */
export const GRID_MAX = 100;

export interface Variant {
  id: string;
  productId: string;
  sellerId: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  /** Unidades presas a checkouts em andamento (Fase 2). O estoque nunca fica abaixo disso. */
  reserved: number;
  weightGrams: number;
  archivedAt: Date | null;
}

/** Uma linha da grade enviada pelo vendedor. O SKU é opcional (ASM-024). */
export interface VariantInput {
  sku?: string | undefined;
  size: string;
  color: string;
  colorHex: string;
  priceCents: number;
  compareAtCents?: number | null | undefined;
  stock: number;
  weightGrams: number;
}

/** O que se grava de uma linha: o SKU já decidido. */
export type VariantData = Omit<VariantInput, 'sku' | 'compareAtCents'> & { sku: string; compareAtCents: number | null };

/**
 * A troca da grade (AC-066). A chave é (tamanho, cor): quem continua é atualizado no lugar,
 * mantendo o id; quem volta é reativado com o id antigo; quem sai é arquivado, nunca apagado.
 */
export interface GridPlan {
  create: VariantData[];
  /** Inclui as reativadas: gravar limpa o `archivedAt`. */
  update: { id: string; data: VariantData }[];
  archive: string[];
  /**
   * Cores que ficam ativas, em `colorKey`: as imagens de outra cor passam a valer para
   * todas (ASM-027).
   */
  colors: string[];
  /** Preço da variante mais barata; nulo com a grade vazia. */
  minPriceCents: number | null;
}

export interface GridRequest {
  sizeType: SizeType;
  productSlug: string;
  /** Todas as variantes do produto, inclusive as arquivadas. */
  existing: readonly Variant[];
  incoming: readonly VariantInput[];
}

/** A cor sem diferenciar maiúsculas: "Preto" e "preto" são a mesma. */
export function colorKey(color: string): string {
  return color.toLocaleLowerCase('pt-BR');
}

/** Mesma combinação de tamanho e cor. */
export function variantKey({ size, color }: { size: string; color: string }): string {
  return `${size}|${colorKey(color)}`;
}

/** `SLUG-TAMANHO-COR`, em maiúsculas e sem acentos (ASM-024). */
export function generatedSku(productSlug: string, size: string, color: string): string {
  return [productSlug, slugify(size), slugify(color)].filter(Boolean).join('-').toUpperCase().slice(0, SKU_MAX);
}

/**
 * Confere a grade inteira e monta a troca. Com algum problema, `issues` aponta cada um pelo
 * índice (`variants.2.priceCents`) e nada deve ser gravado (AC-064).
 */
export function planGrid({ sizeType, productSlug, existing, incoming }: GridRequest): { issues: FieldError[]; plan: GridPlan } {
  const issues: FieldError[] = [];
  const byKey = new Map(existing.map((variant) => [variantKey(variant), variant]));
  const firstIndexOfKey = new Map<string, number>();
  const firstIndexOfSku = new Map<string, number>();
  const plan: GridPlan = { create: [], update: [], archive: [], colors: [], minPriceCents: null };

  incoming.forEach((input, index) => {
    const at = (field: keyof VariantInput) => `variants.${index}.${field}`;
    const key = variantKey(input);
    const match = byKey.get(key);

    if (sizeIndex(sizeType, input.size) < 0) {
      issues.push({ field: at('size'), message: `Use um tamanho da categoria: ${sizeListOf(sizeType)}.` });
    }
    const repeated = firstIndexOfKey.get(key);
    if (repeated === undefined) firstIndexOfKey.set(key, index);
    else issues.push({ field: at('color'), message: `${input.size} / ${input.color} repete a variante ${repeated}.` });

    const compareAtCents = input.compareAtCents ?? null;
    if (compareAtCents !== null && compareAtCents <= input.priceCents) {
      issues.push({ field: at('compareAtCents'), message: 'O preço "de" precisa ser maior que o preço.' });
    }
    if (match && input.stock < match.reserved) {
      issues.push({ field: at('stock'), message: `Há ${match.reserved} unidades reservadas; o estoque não pode ficar abaixo disso.` });
    }

    // O SKU informado vale; sem ele, a variante que continua guarda o que já tinha.
    const sku = input.sku ?? match?.sku ?? generatedSku(productSlug, input.size, input.color);
    const skuRepeated = firstIndexOfSku.get(sku);
    if (skuRepeated === undefined) firstIndexOfSku.set(sku, index);
    // A combinação repetida já foi apontada; o SKU gerado dela repete por consequência.
    else if (repeated === undefined) {
      const hint = input.sku ? '' : ' Informe um SKU para esta variante.';
      issues.push({ field: at('sku'), message: `O SKU ${sku} repete o da variante ${skuRepeated}.${hint}` });
    }

    const { size, color, colorHex, priceCents, stock, weightGrams } = input;
    const data: VariantData = { sku, size, color, colorHex, priceCents, compareAtCents, stock, weightGrams };
    if (match) plan.update.push({ id: match.id, data });
    else plan.create.push(data);
  });

  const kept = new Set(firstIndexOfKey.keys());
  plan.archive = existing.filter((variant) => !variant.archivedAt && !kept.has(variantKey(variant))).map((variant) => variant.id);
  plan.colors = [...new Set(incoming.map((input) => colorKey(input.color)))];
  plan.minPriceCents = incoming.length > 0 ? Math.min(...incoming.map((input) => input.priceCents)) : null;
  return { issues, plan };
}

/** Na ordem da grade de tamanhos e, no mesmo tamanho, pelo nome da cor. */
export function sortVariants<T extends Pick<Variant, 'size' | 'color'>>(sizeType: SizeType, variants: readonly T[]): T[] {
  return variants.toSorted(
    (a, b) => sizeIndex(sizeType, a.size) - sizeIndex(sizeType, b.size) || a.color.localeCompare(b.color, 'pt-BR'),
  );
}

/** Ajuste rápido de estoque (AC-077): pela diferença ou pelo valor final. */
export type StockChange = { delta: number } | { absolute: number };
