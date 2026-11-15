import { Inject, Injectable } from '@nestjs/common';

import type { PixKey } from '../../payments/domain/pix-key.js';
import type { Seller, VerifiedPixKey } from '../domain/seller.js';
import { SellerNotFoundError } from '../domain/seller-errors.js';
import { maskTaxId } from '../domain/tax-id.js';
import { PixKeyVerifier } from './pix-key-verifier.js';
import { SELLER_REPOSITORY, type SellerRepository } from './seller.repository.js';

// Troca da chave Pix pela loja aprovada (AC-056). A chave nova passa pela mesma conferência
// da candidatura; se falhar (422/503), nada muda. Se passar, grava e audita na mesma transação.
@Injectable()
export class ChangePixKeyUseCase {
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository,
    private readonly pixKeys: PixKeyVerifier,
  ) {}

  async execute(seller: Seller, pixKey: PixKey): Promise<VerifiedPixKey> {
    // Fora da transação: a consulta ao Asaas é externa e lenta, não deve segurar a linha travada.
    const verified = await this.pixKeys.verify(pixKey, seller.document);

    return this.sellers.write(async (session) => {
      const current = await session.lockById(seller.id);
      if (!current) throw new SellerNotFoundError();

      const after = await session.update(seller.id, { pixKey: verified });
      await session.audit(seller.id, { pixKey: auditViewOfKey(current.pixKey) }, { pixKey: auditViewOfKey(after.pixKey) });
      return after.pixKey;
    });
  }
}

/** Chave do tipo CPF/CNPJ é o próprio documento: na auditoria ela vai mascarada. */
function auditViewOfKey(pixKey: VerifiedPixKey) {
  const key = pixKey.type === 'CPF' || pixKey.type === 'CNPJ' ? maskTaxId(pixKey.key) : pixKey.key;
  return { type: pixKey.type, key, ownerName: pixKey.ownerName, verifiedAt: pixKey.verifiedAt };
}
