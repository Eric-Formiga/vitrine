import { describe, expect, it } from 'vitest';

import { isValidCnpj, isValidCpf, isValidTaxId, maskTaxId, taxIdDigits } from './tax-id.js';

describe('CPF e CNPJ', () => {
  it('aceita CPF válido com ou sem pontuação', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it('recusa CPF com dígito verificador errado, tamanho errado ou todos iguais', () => {
    expect(isValidCpf('111.444.777-36')).toBe(false);
    expect(isValidCpf('1114447773')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('aceita CNPJ válido e recusa o inválido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
  });

  it('isValidTaxId aceita os dois e mais nada', () => {
    expect(isValidTaxId('111.444.777-35')).toBe(true);
    expect(isValidTaxId('11.222.333/0001-81')).toBe(true);
    expect(isValidTaxId('123')).toBe(false);
    expect(isValidTaxId('abc.def.ghi-jk')).toBe(false);
  });

  it('extrai os dígitos e mascara no estilo do Asaas', () => {
    expect(taxIdDigits('111.444.777-35')).toBe('11144477735');
    expect(maskTaxId('111.444.777-35')).toBe('***.444.777-**');
    expect(maskTaxId('11.222.333/0001-81')).toBe('**.***.333/0001-**');
  });
});
