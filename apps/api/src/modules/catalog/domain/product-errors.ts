import { DomainError } from '../../../shared/errors/domain-error.js';
import type { ProductStatus } from './product.js';

export class ProductNotFoundError extends DomainError {
  readonly code = 'PRODUCT_NOT_FOUND';
  override readonly status = 404;

  constructor() {
    super('Produto não encontrado.');
  }
}

/** Outra escrita gravou depois que quem chama leu o produto (If-Match desatualizado, AC-075). */
export class ProductVersionConflictError extends DomainError {
  readonly code = 'PRODUCT_VERSION_CONFLICT';
  override readonly status = 412;

  constructor(currentVersion: number) {
    super('Este produto mudou desde que você o abriu (talvez em outra aba). Recarregue antes de gravar.', {
      currentVersion,
    });
  }
}

const STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'em rascunho',
  ACTIVE: 'ativo',
  SUSPENDED: 'suspenso',
  ARCHIVED: 'arquivado',
};

const ACTION_LABEL = {
  edit: 'alterar',
  archive: 'arquivar',
} as const;

export type ProductAction = keyof typeof ACTION_LABEL;

/** A ação não vale para a situação atual do produto (ex.: editar um produto arquivado). */
export class InvalidProductStateError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION';
  override readonly status = 422;

  constructor(action: ProductAction, current: ProductStatus) {
    super(`Não dá para ${ACTION_LABEL[action]} um produto ${STATUS_LABEL[current]}.`, { currentStatus: current });
  }
}
