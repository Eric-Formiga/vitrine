import { Inject, Injectable } from '@nestjs/common';

import { type Product, transition } from '../domain/product.js';
import { PRODUCT_REPOSITORY, type ProductRepository } from './product.repository.js';

// AC-079, AC-080: o admin suspende o produto ativo (com motivo) e reativa o suspenso.
// Sem If-Match, mas a versão sobe; o antes e o depois vão para a auditoria.
@Injectable()
export class ModerateProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  suspend(productId: string, reason: string, now = new Date()): Promise<Product> {
    return this.products.moderate(productId, (current) => transition(current, { kind: 'suspend', reason }, now));
  }

  reinstate(productId: string, now = new Date()): Promise<Product> {
    return this.products.moderate(productId, (current) => transition(current, { kind: 'reinstate' }, now));
  }
}
