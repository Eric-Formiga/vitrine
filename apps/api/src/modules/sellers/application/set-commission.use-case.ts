import { Inject, Injectable } from '@nestjs/common';

import { auditViewOf } from '../domain/seller.js';
import { SellerNotFoundError } from '../domain/seller-errors.js';
import { SELLER_REPOSITORY, type SellerRepository, type SellerWithOwner } from './seller.repository.js';

// Comissão própria da loja, em pontos-base, ou `null` para voltar à padrão (AC-054, ASM-018).
// O limite (0 a 10000) é conferido na entrada; aqui só grava e audita junto.
@Injectable()
export class SetCommissionUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository) {}

  execute(sellerId: string, commissionBps: number | null): Promise<SellerWithOwner> {
    return this.sellers.write(async (session) => {
      const current = await session.lockById(sellerId);
      if (!current) throw new SellerNotFoundError();

      const after = await session.update(sellerId, { commissionBps });
      await session.audit(sellerId, auditViewOf(current), auditViewOf(after));
      return after;
    });
  }
}
