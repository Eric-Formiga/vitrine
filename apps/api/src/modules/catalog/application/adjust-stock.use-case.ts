import { Inject, Injectable } from '@nestjs/common';

import { RequestValidationError } from '../../../shared/errors/domain-error.js';
import { InvalidProductStateError } from '../domain/product-errors.js';
import { STOCK_MAX, type StockChange } from '../domain/variant.js';
import { StockWouldBeNegativeError, VariantNotFoundError } from '../domain/variant-errors.js';
import { VARIANT_REPOSITORY, type VariantRepository } from './variant.repository.js';

// AC-077, AC-078: corrige o estoque de uma variante sem reenviar a grade. Não usa If-Match
// nem muda a versão do produto: o banco aplica cada ajuste sobre o valor que estiver lá.
@Injectable()
export class AdjustStockUseCase {
  constructor(@Inject(VARIANT_REPOSITORY) private readonly variants: VariantRepository) {}

  async execute(sellerId: string, variantId: string, change: StockChange): Promise<number> {
    const result = await this.variants.adjustStock(sellerId, variantId, change);
    switch (result.kind) {
      case 'adjusted':
        return result.stock;
      case 'not-found':
        throw new VariantNotFoundError();
      case 'product-locked':
        throw new InvalidProductStateError('edit', result.status);
      case 'below-reserved':
        throw new StockWouldBeNegativeError(result.stock, result.reserved);
      case 'above-max':
        throw new RequestValidationError([
          { field: 'delta' in change ? 'delta' : 'absolute', message: `O estoque passaria de ${STOCK_MAX}.` },
        ]);
    }
  }
}
