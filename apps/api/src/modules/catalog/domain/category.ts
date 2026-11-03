// Regras puras da árvore de categorias: sem Nest, sem Prisma (ADR-0002).
import type { SizeChart } from './size-chart.js';

export const SIZE_TYPES = ['CLOTHING', 'SHOES', 'ONE_SIZE'] as const;
export type SizeType = (typeof SIZE_TYPES)[number];

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  position: number;
  sizeType: SizeType;
  sizeChart: SizeChart | null;
  archivedAt: Date | null;
}

export type CategoryNode = Category & { children: CategoryNode[] };

/**
 * Monta a árvore a partir da lista plana. Em cada nível: posição e, empatadas, nome.
 * Quem aponta para uma pai que não está na lista fica de fora (ex.: filha de arquivada
 * quando a lista só tem as ativas).
 */
export function buildTree(categories: readonly Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>();
  for (const category of categories) {
    const siblings = byParent.get(category.parentId) ?? [];
    siblings.push(category);
    byParent.set(category.parentId, siblings);
  }

  const build = (parentId: string | null): CategoryNode[] =>
    (byParent.get(parentId) ?? [])
      .toSorted((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'pt-BR'))
      .map((category) => ({ ...category, children: build(category.id) }));

  return build(null);
}

/** Ids de todas as descendentes (filhas, netas...), sem incluir a própria categoria. */
export function descendantIds(categories: readonly Category[], id: string): string[] {
  const children = categories.filter((c) => c.parentId === id);
  return children.flatMap((child) => [child.id, ...descendantIds(categories, child.id)]);
}

/** Pôr `id` dentro de `newParentId` criaria um ciclo (ela mesma ou uma descendente)? */
export function wouldCreateCycle(categories: readonly Category[], id: string, newParentId: string): boolean {
  return newParentId === id || descendantIds(categories, id).includes(newParentId);
}
