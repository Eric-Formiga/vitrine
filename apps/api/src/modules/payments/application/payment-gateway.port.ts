// Porta de pagamento (ADR-0011, ADR-0012): os casos de uso falam com isto, nunca com o
// Asaas. Os tipos são da Vitrine (centavos, nomes do domínio), não os do provedor.
import type { PixKey, PixKeyOwner } from '../domain/pix-key.js';

export interface PaymentGateway {
  /** Titular da chave Pix. Lança PixKeyNotFoundError se a chave não existe. */
  lookupPixKey(pixKey: PixKey): Promise<PixKeyOwner>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
