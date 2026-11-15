import { DomainError, RequestValidationError } from '../../../shared/errors/domain-error.js';

/** A conta já tem loja em análise, aprovada ou suspensa, ou foi rejeitada há menos de 7 dias. */
export class SellerApplicationExistsError extends DomainError {
  readonly code = 'SELLER_APPLICATION_EXISTS';
  override readonly status = 409;

  constructor(canReapplyAt?: Date) {
    super(
      canReapplyAt
        ? `Sua candidatura foi recusada. Você pode se candidatar de novo a partir de ${canReapplyAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`
        : 'Esta conta já tem uma loja (em análise, aprovada ou suspensa).',
      canReapplyAt ? { canReapplyAt: canReapplyAt.toISOString() } : undefined,
    );
  }
}

/** O CPF/CNPJ já é de outra loja: uma loja por documento (Q-008). */
export class DocumentTakenError extends DomainError {
  readonly code = 'DOCUMENT_TAKEN';
  override readonly status = 409;

  constructor() {
    super('Este CPF/CNPJ já tem uma loja na Vitrine.');
  }
}

export class SellerSlugTakenError extends DomainError {
  readonly code = 'SLUG_TAKEN';
  override readonly status = 409;

  constructor(slug: string) {
    super(`O endereço "${slug}" já é usado por outra loja. Escolha outro.`);
  }
}

/** Não deu para conferir a chave Pix agora (Asaas fora do ar ou com erro): tente de novo depois (Q-007). */
export class PixKeyCheckUnavailableError extends DomainError {
  readonly code = 'PIX_KEY_CHECK_UNAVAILABLE';
  override readonly status = 503;

  constructor() {
    super('Não conseguimos conferir a chave Pix agora. Tente de novo em alguns minutos.');
  }
}

const DECISION_LABEL = {
  approve: 'aprovar',
  reject: 'rejeitar',
  suspend: 'suspender',
  reinstate: 'reativar',
} as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'em análise',
  APPROVED: 'aprovada',
  REJECTED: 'rejeitada',
  SUSPENDED: 'suspensa',
};

/** A decisão não vale para a situação atual da loja (ex.: aprovar uma loja já rejeitada). */
export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION';
  override readonly status = 422;

  constructor(decision: keyof typeof DECISION_LABEL, current: string) {
    super(`Não dá para ${DECISION_LABEL[decision]} uma loja ${STATUS_LABEL[current] ?? current}.`, { currentStatus: current });
  }
}

export class SellerNotFoundError extends DomainError {
  readonly code = 'SELLER_NOT_FOUND';
  override readonly status = 404;

  constructor() {
    super('Loja não encontrada.');
  }
}

/** A pessoa tem o papel seller, mas a loja não está aprovada (ex.: suspensa). Spec 01 H3. */
export class SellerNotActiveError extends DomainError {
  readonly code = 'SELLER_NOT_ACTIVE';
  override readonly status = 403;

  constructor(status: string | null) {
    super(
      status === 'SUSPENDED'
        ? 'Sua loja está suspensa. Fale com a equipe da Vitrine para entender o motivo.'
        : 'Sua loja não está aprovada para vender.',
      status ? { sellerStatus: status } : undefined,
    );
  }
}

export class ShippingNotConfiguredError extends DomainError {
  readonly code = 'SHIPPING_NOT_CONFIGURED';
  override readonly status = 404;

  constructor() {
    super('A loja ainda não configurou o frete.');
  }
}

export class SellerApplicationNotFoundError extends DomainError {
  readonly code = 'SELLER_APPLICATION_NOT_FOUND';
  override readonly status = 404;

  constructor() {
    super('Você ainda não tem uma loja. Candidate-se em /vender.');
  }
}

/** Categoria principal inexistente ou arquivada: erro de entrada, como o de categoria pai. */
export function mainCategoryNotFound(): RequestValidationError {
  return new RequestValidationError([{ field: 'mainCategoryId', message: 'Escolha uma categoria ativa.' }]);
}

/** Nome sem nenhuma letra ou número aproveitável para o endereço da loja. */
export function slugRequired(): RequestValidationError {
  return new RequestValidationError([
    { field: 'slug', message: 'Não deu para gerar o endereço da loja a partir do nome. Informe um slug.' },
  ]);
}
