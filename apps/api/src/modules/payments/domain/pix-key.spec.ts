import { describe, expect, it } from 'vitest';

import { PixKeyOwnerMismatchError } from './payment-errors.js';
import { assertPixKeyOwner } from './pix-key.js';

const dono = (maskedDocument: string) => ({ name: 'Titular', maskedDocument });

describe('Conferência do titular da chave Pix (ADR-0012)', () => {
  it('aceita CPF cujos dígitos visíveis batem com o mascarado', () => {
    expect(() => assertPixKeyOwner(dono('***.202.745-**'), '111.202.745-91')).not.toThrow();
    expect(() => assertPixKeyOwner(dono('***.202.745-**'), '11120274591')).not.toThrow();
  });

  it('aceita CNPJ cujos dígitos visíveis batem', () => {
    expect(() => assertPixKeyOwner(dono('**.381.637/0001-**'), '35.381.637/0001-50')).not.toThrow();
  });

  it('recusa quando algum dígito visível é diferente', () => {
    expect(() => assertPixKeyOwner(dono('***.202.745-**'), '52998224725')).toThrow(PixKeyOwnerMismatchError);
  });

  it('recusa CPF contra titular com CNPJ (tamanhos diferentes)', () => {
    expect(() => assertPixKeyOwner(dono('**.381.637/0001-**'), '11120274591')).toThrow(PixKeyOwnerMismatchError);
  });

  it('recusa quando o mascarado mostra menos de 4 dígitos (não dá para conferir)', () => {
    expect(() => assertPixKeyOwner(dono('*********-91'), '11120274591')).toThrow(PixKeyOwnerMismatchError);
  });
});
