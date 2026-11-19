import type { Schemas } from '@vitrine/api-client';

// Gerador da grade de variantes (AC-084): regras puras, sem React. A tela marca tamanhos
// e cores; daqui saem as linhas (uma por tamanho × cor), mantendo o que já foi digitado
// nas combinações que continuam.

export type SizeType = Schemas['PublicCategoryNode']['sizeType'];
export type SellerVariant = Schemas['SellerVariant'];
export type VariantInput = Schemas['VariantInput'];

/** A mesma lista da API (T-021): roupas, calçados e tamanho único. */
export const SIZE_GRID: Readonly<Record<SizeType, readonly string[]>> = {
  CLOTHING: ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
  SHOES: Array.from({ length: 14 }, (_, i) => String(33 + i)),
  ONE_SIZE: ['U'],
};

export interface GridColor {
  name: string;
  /** #RRGGBB */
  hex: string;
}

/** Uma linha da tabela, com os valores como o vendedor digita (texto, preço em reais). */
export interface GridRow {
  size: string;
  color: string;
  colorHex: string;
  /** Em reais, ex.: "199,90". */
  price: string;
  compareAt: string;
  stock: string;
  weightGrams: string;
  sku: string;
}

/** A mesma regra da API: "Preto" e "preto" são a mesma cor. */
export const rowKey = (size: string, color: string) => `${size}|${color.trim().toLocaleLowerCase('pt-BR')}`;

/**
 * As linhas da grade para os tamanhos e cores marcados, na ordem da lista de tamanhos e,
 * dentro de cada tamanho, na ordem das cores. A combinação que já existia mantém os
 * valores digitados (só o hex acompanha a cor); a nova nasce vazia, com estoque 0.
 */
export function generateRows(
  sizeType: SizeType,
  sizes: readonly string[],
  colors: readonly GridColor[],
  current: readonly GridRow[],
): GridRow[] {
  const byKey = new Map(current.map((row) => [rowKey(row.size, row.color), row]));
  const chosen = SIZE_GRID[sizeType].filter((size) => sizes.includes(size));
  const seen = new Set<string>();
  const usable = colors.filter((color) => {
    const key = color.name.trim().toLocaleLowerCase('pt-BR');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return chosen.flatMap((size) =>
    usable.map((color): GridRow => {
      const kept = byKey.get(rowKey(size, color.name));
      return kept
        ? { ...kept, color: color.name.trim(), colorHex: color.hex }
        : { size, color: color.name.trim(), colorHex: color.hex, price: '', compareAt: '', stock: '0', weightGrams: '', sku: '' };
    }),
  );
}

/** Tamanhos e cores marcados numa grade já salva, para a tela abrir como estava. */
export function selectionOf(rows: readonly GridRow[]): { sizes: string[]; colors: GridColor[] } {
  const sizes = [...new Set(rows.map((row) => row.size))];
  const colors: GridColor[] = [];
  for (const row of rows) {
    if (!colors.some((color) => color.name.toLocaleLowerCase('pt-BR') === row.color.toLocaleLowerCase('pt-BR'))) {
      colors.push({ name: row.color, hex: row.colorHex });
    }
  }
  return { sizes, colors };
}

/** "199,90", "199.90", "R$ 1.299,90" ou "199" → centavos; nulo se não for um valor. */
export function parseReais(text: string): number | null {
  const clean = text.replace(/R\$|\s/g, '');
  if (!clean) return null;
  // Com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é o decimal.
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Centavos → "199,90". */
export function formatReais(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** A grade salva na API, como linhas da tabela. */
export function rowsFromVariants(variants: readonly SellerVariant[]): GridRow[] {
  return variants.map((variant) => ({
    size: variant.size,
    color: variant.color,
    colorHex: variant.colorHex,
    price: formatReais(variant.priceCents),
    compareAt: variant.compareAtCents === null ? '' : formatReais(variant.compareAtCents),
    stock: String(variant.stock),
    weightGrams: String(variant.weightGrams),
    sku: variant.sku,
  }));
}

const INTEGER = /^\d+$/;

/**
 * As linhas no formato da API. O que não dá para converter (preço que não é valor em
 * reais, estoque ou peso que não são inteiros) volta como erro no mesmo campo que a API
 * usaria (`variants.2.priceCents`), sem chamar a API.
 */
export function toVariantInputs(rows: readonly GridRow[]): { variants: VariantInput[]; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const variants = rows.map((row, index): VariantInput => {
    const at = (field: string) => `variants.${index}.${field}`;
    const priceCents = parseReais(row.price);
    if (priceCents === null) errors[at('priceCents')] = 'Informe o preço em reais, ex.: 199,90.';
    const compareAtCents = row.compareAt.trim() ? parseReais(row.compareAt) : null;
    if (row.compareAt.trim() && compareAtCents === null) errors[at('compareAtCents')] = 'Informe o preço "de" em reais.';
    if (!INTEGER.test(row.stock.trim())) errors[at('stock')] = 'Informe o estoque com um número inteiro.';
    if (!INTEGER.test(row.weightGrams.trim())) errors[at('weightGrams')] = 'Informe o peso em gramas.';
    const sku = row.sku.trim();
    return {
      size: row.size,
      color: row.color,
      colorHex: row.colorHex,
      priceCents: priceCents ?? 0,
      compareAtCents,
      stock: Number(row.stock.trim()),
      weightGrams: Number(row.weightGrams.trim()),
      ...(sku ? { sku } : {}),
    };
  });
  return { variants, errors };
}
