import { Inject, Injectable, Logger } from '@nestjs/common';

import { PAYMENT_GATEWAY, type PaymentGateway } from '../../payments/application/payment-gateway.port.js';
import { PixKeyNotFoundError } from '../../payments/domain/payment-errors.js';
import { assertPixKeyOwner, type PixKey } from '../../payments/domain/pix-key.js';
import type { VerifiedPixKey } from '../domain/seller.js';
import { PixKeyCheckUnavailableError } from '../domain/seller-errors.js';

// Conferência do titular da chave Pix no Asaas (ADR-0012). Usada na candidatura (AC-045,
// AC-046) e na troca de chave (AC-056), com os mesmos erros nos dois lugares.
@Injectable()
export class PixKeyVerifier {
  private readonly logger = new Logger('ChavePix');

  constructor(@Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway) {}

  /**
   * Chave inexistente e titular diferente passam como estão (422); qualquer outra falha
   * do provedor vira "tente depois" (503). Quem chama não grava nada se der erro.
   */
  async verify(pixKey: PixKey, document: string): Promise<VerifiedPixKey> {
    let owner;
    try {
      owner = await this.gateway.lookupPixKey(pixKey);
    } catch (error) {
      if (error instanceof PixKeyNotFoundError) throw error;
      this.logger.warn({ err: error, msg: 'conferência de chave Pix indisponível' });
      throw new PixKeyCheckUnavailableError();
    }
    assertPixKeyOwner(owner, document);
    return { ...pixKey, ownerName: owner.name, ownerDocument: owner.maskedDocument, verifiedAt: new Date() };
  }
}
