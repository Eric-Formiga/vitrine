import { Inject, Injectable } from '@nestjs/common';

import { type Product, transition } from '../domain/product.js';
import { PRODUCT_REPOSITORY, type ProductRef, type ProductRepository } from './product.repository.js';

// AC-076: arquivar não apaga (RN-17); as variantes e as imagens ficam. É final (ASM-030).
@Injectable()
export class ArchiveProductUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(ref: ProductRef, now = new Date()): Promise<Product> {
    const { product } = await this.products.write(ref, async (current) => ({
      changes: transition(current, { kind: 'archive' }, now),
      value: undefined,
    }));
    return product;
  }
}
