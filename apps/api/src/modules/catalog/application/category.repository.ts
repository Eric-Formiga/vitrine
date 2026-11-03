import type { Category, SizeType } from '../domain/category.js';
import type { SizeChart } from '../domain/size-chart.js';

export interface NewCategory {
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  sizeType: SizeType;
  sizeChart: SizeChart | null;
}

export type CategoryChanges = Partial<NewCategory>;

/** O que um caso de uso pode fazer dentro de uma escrita (uma transação). */
export interface CategoryWriteSession {
  /** Todas as categorias, inclusive as arquivadas, lidas dentro da transação. */
  findAll(): Promise<Category[]>;
  /** Lança SlugTakenError se o slug já existir. */
  insert(data: NewCategory): Promise<Category>;
  /** Lança SlugTakenError se o novo slug já existir. */
  update(id: string, changes: CategoryChanges): Promise<Category>;
  setArchivedAt(ids: string[], at: Date | null): Promise<void>;
  /** Registro de auditoria na mesma transação (some junto se a escrita for desfeita). */
  audit(entityId: string, before: unknown, after: unknown): Promise<void>;
}

// Porta: os casos de uso dependem disto, não do Prisma.
export interface CategoryRepository {
  /** Todas as categorias, inclusive as arquivadas. */
  findAll(): Promise<Category[]>;
  /**
   * Executa uma escrita numa transação que trava a árvore: duas escritas nunca se
   * cruzam, então a checagem de ciclo (ler a árvore e depois mover) não fica obsoleta.
   */
  write<T>(work: (session: CategoryWriteSession) => Promise<T>): Promise<T>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
