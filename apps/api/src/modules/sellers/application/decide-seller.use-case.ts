import { Inject, Injectable } from '@nestjs/common';

import { UserRolesService } from '../../identity/application/user-roles.service.js';
import { auditViewOf, decide, type SellerDecision } from '../domain/seller.js';
import { SellerNotFoundError } from '../domain/seller-errors.js';
import { SELLER_REPOSITORY, type SellerRepository, type SellerWithOwner } from './seller.repository.js';

// Aprovar, rejeitar, suspender e reativar (AC-051 a AC-053). A mudança de situação, o papel
// `seller` (só ao aprovar) e o registro de auditoria entram na mesma transação.
@Injectable()
export class DecideSellerUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository,
    private readonly userRoles: UserRolesService,
  ) {}

  async execute(sellerId: string, decision: SellerDecision): Promise<SellerWithOwner> {
    const updated = await this.sellers.write(async (session) => {
      const current = await session.lockById(sellerId);
      if (!current) throw new SellerNotFoundError();

      const after = await session.update(sellerId, decide(current, decision, new Date()));
      // Suspender e reativar não mexem no papel: a loja suspensa é barrada pela situação.
      if (decision.kind === 'approve') await session.grantRole(current.userId, 'seller');
      await session.audit(sellerId, auditViewOf(current), auditViewOf(after));
      return after;
    });

    // Depois do commit: a dona já entra como vendedora na próxima chamada (AC-051).
    if (decision.kind === 'approve') this.userRoles.refresh(updated.userId);
    return updated;
  }
}
