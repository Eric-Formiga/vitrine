import { DomainError } from '../../../shared/errors/domain-error.js';
import type { SizeType } from './category.js';
import { sizeListOf } from './size-grid.js';

export class VariantNotFoundError extends DomainError {
  readonly code = 'VARIANT_NOT_FOUND';
  override readonly status = 404;

  constructor() {
    super('Variante não encontrada.');
  }
}

/**
 * Outra variante ativa da mesma loja já usa o SKU (AC-065). `sku` nulo: duas gravações
 * simultâneas disputaram o mesmo SKU, e o índice só diz que houve conflito.
 */
export class SkuTakenError extends DomainError {
  readonly code = 'SKU_TAKEN';
  override readonly status = 409;

  constructor(sku: string | null) {
    super(
      sku ? `O SKU ${sku} já está em outra variante da sua loja.` : 'Um dos SKUs já está em outra variante da sua loja.',
      { sku },
    );
  }
}

/** O ajuste deixaria o estoque abaixo de zero, ou abaixo do que está reservado (AC-078). */
export class StockWouldBeNegativeError extends DomainError {
  readonly code = 'STOCK_WOULD_BE_NEGATIVE';
  override readonly status = 422;

  constructor(currentStock: number, reserved: number) {
    const detail = reserved > 0 ? ` (${reserved} reservadas)` : '';
    super(`O estoque atual é ${currentStock}${detail}; o ajuste o deixaria negativo.`, { currentStock });
  }
}

/**
 * A nova categoria usa outra grade de tamanhos (ex.: de roupas para calçados) e o produto
 * tem variantes ativas, que ficariam com tamanhos fora da lista.
 */
export class SizeGridMismatchError extends DomainError {
  readonly code = 'SIZE_GRID_MISMATCH';
  override readonly status = 422;

  constructor(sizeType: SizeType) {
    super(`A nova categoria usa os tamanhos ${sizeListOf(sizeType)}. Esvazie a grade antes de trocar.`, { sizeType });
  }
}
