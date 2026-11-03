import { DomainError, RequestValidationError } from '../../../shared/errors/domain-error.js';

export class CategoryNotFoundError extends DomainError {
  readonly code = 'CATEGORY_NOT_FOUND';
  override readonly status = 404;

  constructor() {
    super('Categoria não encontrada.');
  }
}

export class SlugTakenError extends DomainError {
  readonly code = 'SLUG_TAKEN';
  override readonly status = 409;

  constructor(slug: string) {
    super(`O slug "${slug}" já é usado por outra categoria (inclusive arquivada). Escolha outro.`);
  }
}

export class InvalidCategoryParentError extends DomainError {
  readonly code = 'INVALID_CATEGORY_PARENT';

  constructor(reason: 'cycle' | 'archived') {
    super(
      reason === 'cycle'
        ? 'Uma categoria não pode ficar dentro dela mesma nem de uma descendente.'
        : 'A categoria pai está arquivada. Restaure a pai antes.',
    );
  }
}

/** Pai informada que não existe: erro de entrada, no mesmo formato da validação (400 com errors). */
export function parentNotFound(): RequestValidationError {
  return new RequestValidationError([{ field: 'parentId', message: 'Categoria pai não encontrada.' }]);
}
