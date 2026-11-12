// Chave Pix de recebimento da loja (ADR-0012): regras puras, sem Nest nem provedor.
import { PixKeyOwnerMismatchError } from './payment-errors.js';

export const PIX_KEY_TYPES = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];

export interface PixKey {
  type: PixKeyType;
  key: string;
}

/** Titular da chave, como o provedor devolve: o documento vem mascarado (ex.: ***.202.745-**). */
export interface PixKeyOwner {
  name: string;
  maskedDocument: string;
}

const MIN_VISIBLE_DIGITS = 4;

/**
 * Confere que o titular da chave é a loja: cada dígito visível do documento mascarado
 * precisa bater com o CPF/CNPJ da loja, na mesma posição. Com poucos dígitos visíveis,
 * ou documentos de tamanhos diferentes (CPF × CNPJ), não dá para afirmar: recusa.
 */
export function assertPixKeyOwner(owner: PixKeyOwner, storeDocument: string): void {
  const masked = owner.maskedDocument.replace(/[^0-9*]/g, '');
  const document = storeDocument.replace(/\D/g, '');

  const visible = [...masked].filter((char) => char !== '*').length;
  const sameShape = masked.length === document.length && visible >= MIN_VISIBLE_DIGITS;
  const matches = sameShape && [...masked].every((char, i) => char === '*' || char === document[i]);

  if (!matches) throw new PixKeyOwnerMismatchError();
}
