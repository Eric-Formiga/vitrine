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
