import { describe, expect, it } from 'vitest';

import { type ShippingSettings, shippingIssues, zipDigits } from './shipping.js';

const VALID: ShippingSettings = {
  originZip: '01310100',
  rates: { N: 2990, NE: 2490, CO: 2290, SE: 1590, S: 1990 },
  freeShippingThresholdCents: 29900,
  handlingDays: 2,
};

const fieldsOf = (settings: ShippingSettings) => shippingIssues(settings).map((issue) => issue.field);

describe('configuração de frete da loja', () => {
  it('aceita a configuração completa, frete zero e sem frete grátis', () => {
    expect(shippingIssues(VALID)).toEqual([]);
    expect(shippingIssues({ ...VALID, rates: { ...VALID.rates, SE: 0 }, freeShippingThresholdCents: null })).toEqual([]);
  });

  it('CEP: só 8 dígitos (a pontuação sai antes)', () => {
    expect(zipDigits('01310-100')).toBe('01310100');
    expect(fieldsOf({ ...VALID, originZip: '0131010' })).toEqual(['originZip']);
    expect(fieldsOf({ ...VALID, originZip: '013101000' })).toEqual(['originZip']);
  });

  it('cada região é obrigatória, em centavos inteiros e sem sinal', () => {
    const semSul: Partial<ShippingSettings['rates']> = { ...VALID.rates };
    delete semSul.S;
    expect(fieldsOf({ ...VALID, rates: semSul as ShippingSettings['rates'] })).toEqual(['rates.S']);
    expect(fieldsOf({ ...VALID, rates: { ...VALID.rates, N: -1, NE: 12.5 } })).toEqual(['rates.N', 'rates.NE']);
  });

  it('frete grátis, quando existe, é a partir de um valor maior que zero', () => {
    expect(fieldsOf({ ...VALID, freeShippingThresholdCents: 0 })).toEqual(['freeShippingThresholdCents']);
  });

  it('prazo de postagem de 1 a 5 dias úteis', () => {
    expect(fieldsOf({ ...VALID, handlingDays: 1 })).toEqual([]);
    expect(fieldsOf({ ...VALID, handlingDays: 5 })).toEqual([]);
    expect(fieldsOf({ ...VALID, handlingDays: 0 })).toEqual(['handlingDays']);
    expect(fieldsOf({ ...VALID, handlingDays: 6 })).toEqual(['handlingDays']);
  });
});
