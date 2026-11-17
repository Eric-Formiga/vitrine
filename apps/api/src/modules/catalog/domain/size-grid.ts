// Os tamanhos que cada tipo de categoria aceita (spec 03 H1), na ordem em que aparecem.
import type { SizeType } from './category.js';

const SHOE_SIZES = Array.from({ length: 14 }, (_, i) => String(33 + i));

export const SIZE_GRID: Readonly<Record<SizeType, readonly string[]>> = {
  CLOTHING: ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
  SHOES: SHOE_SIZES,
  ONE_SIZE: ['U'],
};

/** Posição do tamanho na grade do tipo; -1 se ele não pertence a ela. */
export function sizeIndex(sizeType: SizeType, size: string): number {
  return SIZE_GRID[sizeType].indexOf(size);
}

export function sizeListOf(sizeType: SizeType): string {
  const sizes = SIZE_GRID[sizeType];
  return sizes.length > 6 ? `${sizes[0]} a ${sizes.at(-1)}` : sizes.join(', ');
}
