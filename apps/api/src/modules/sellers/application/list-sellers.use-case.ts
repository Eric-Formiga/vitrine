import { Inject, Injectable } from '@nestjs/common';

import type { SellerStatus } from '../domain/seller.js';
import { SELLER_REPOSITORY, type SellerRepository, type SellerWithOwner } from './seller.repository.js';

// Fila do admin: as lojas de uma situação, da candidatura mais antiga para a mais nova (AC-050).
@Injectable()
export class ListSellersUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository) {}

  execute(status: SellerStatus): Promise<SellerWithOwner[]> {
    return this.sellers.listByStatus(status);
  }
}
