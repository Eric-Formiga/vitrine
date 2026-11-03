// Base dos erros de regra de negócio (ex.: OUT_OF_STOCK, COUPON_INVALID — ver docs/API.md).
// O filtro global transforma qualquer um deles em problem+json com o `code` e o status certos.
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly status: number = 422;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export interface FieldError {
  /** Caminho do campo no corpo, com pontos: "sizeChart.rows". Vazio = o corpo inteiro. */
  field: string;
  message: string;
}

// Entrada inválida: 400 com a lista de campos (`errors` no problem+json, docs/API.md).
// Vem do pipe de validação (formato) ou de um caso de uso (ex.: categoria pai inexistente).
export class RequestValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
  override readonly status = 400;

  constructor(readonly errors: FieldError[]) {
    super('Alguns campos estão inválidos. Veja a lista em "errors".');
  }
}
