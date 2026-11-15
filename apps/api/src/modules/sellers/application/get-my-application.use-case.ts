import { Inject, Injectable } from '@nestjs/common';

import { checklistOf, type Seller, type SellerChecklist } from '../domain/seller.js';
import { SellerApplicationNotFoundError } from '../domain/seller-errors.js';
import { SELLER_REPOSITORY, type SellerRepository } from './seller.repository.js';

export interface MyApplication {
  seller: Seller;
  checklist: SellerChecklist;
}

// A pessoa acompanha a própria loja, em qualquer situação (AC-049; spec 01 H3: "leitura de status").
@Injectable()
export class GetMyApplicationUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository) {}

  async execute(userId: string): Promise<MyApplication> {
    const seller = await this.sellers.findByUserId(userId);
    if (!seller) throw new SellerApplicationNotFoundError();
    return { seller, checklist: checklistOf(seller, await this.sellers.hasShipping(seller.id)) };
  }
}
