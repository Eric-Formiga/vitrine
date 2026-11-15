import { type CanActivate, createParamDecorator, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SELLER_REPOSITORY, type SellerRepository } from '../application/seller.repository.js';
import type { Seller } from '../domain/seller.js';
import { SellerNotActiveError } from '../domain/seller-errors.js';

type SellerRequest = Request & { user?: { id: string }; seller?: Seller };

// Área do vendedor (spec 01 H3, AC-055). Roda depois dos guards globais: o de login já
// carregou a pessoa, e o de papéis já respondeu 404 a quem não tem `seller`. Aqui a
// situação da loja decide: só a aprovada passa; a suspensa recebe 403 SELLER_NOT_ACTIVE.
@Injectable()
export class ApprovedSellerGuard implements CanActivate {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SellerRequest>();
    const seller = req.user ? await this.sellers.findByUserId(req.user.id) : null;
    if (seller?.status !== 'APPROVED') throw new SellerNotActiveError(seller?.status ?? null);
    req.seller = seller;
    return true;
  }
}

/** A loja aprovada de quem chama, já carregada pelo ApprovedSellerGuard. */
export const CurrentSeller = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Seller => context.switchToHttp().getRequest<SellerRequest>().seller as Seller,
);
