import { describe, expect, it } from 'vitest';

import { generatedSku, planGrid, sortVariants, type Variant, type VariantInput } from './variant.js';

const linha = (size: string, color = 'Preto', extra: Partial<VariantInput> = {}): VariantInput => ({
  size,
  color,
  colorHex: '#000000',
  priceCents: 19900,
  stock: 5,
  weightGrams: 300,
  ...extra,
});

const gravada = (id: string, size: string, color = 'Preto', extra: Partial<Variant> = {}): Variant => ({
  id,
  productId: 'p',
  sellerId: 's',
  sku: `SKU-${id}`,
  size,
  color,
  colorHex: '#000000',
  priceCents: 19900,
  compareAtCents: null,
  stock: 5,
  reserved: 0,
  weightGrams: 300,
  archivedAt: null,
  ...extra,
});

const plano = (incoming: VariantInput[], existing: Variant[] = []) =>
  planGrid({ sizeType: 'CLOTHING', productSlug: 'vestido-midi', existing, incoming });

describe('grade de variantes', () => {
  it('gera o SKU do slug, do tamanho e da cor, em maiúsculas e sem acentos', () => {
    expect(generatedSku('vestido-midi', 'M', 'Azul Petróleo')).toBe('VESTIDO-MIDI-M-AZUL-PETROLEO');
    expect(generatedSku('tenis', '38', 'Off-White')).toBe('TENIS-38-OFF-WHITE');
  });

  it('aponta cada problema pelo índice da variante', () => {
    const { issues } = plano([
      linha('M'),
      linha('38'),
      linha('M', 'preto'),
      linha('G', 'Preto', { compareAtCents: 19900 }),
      linha('P', 'Preto', { sku: 'IGUAL' }),
      linha('PP', 'Preto', { sku: 'IGUAL' }),
    ]);
    expect(issues.map((issue) => issue.field)).toEqual([
      'variants.1.size',
      'variants.2.color',
      'variants.3.compareAtCents',
      'variants.5.sku',
    ]);
  });

  it('não deixa o estoque abaixo do que está reservado', () => {
    const { issues } = plano([linha('M', 'Preto', { stock: 1 })], [gravada('a', 'M', 'Preto', { stock: 5, reserved: 2 })]);
    expect(issues).toEqual([expect.objectContaining({ field: 'variants.0.stock' })]);
  });

  it('mantém quem continua, reativa quem volta, arquiva quem sai e cria o resto', () => {
    const existentes = [
      gravada('m', 'M'),
      gravada('g', 'G'),
      gravada('p-arquivada', 'P', 'Preto', { archivedAt: new Date() }),
      gravada('gg-arquivada', 'GG', 'Preto', { archivedAt: new Date() }),
    ];
    const { issues, plan } = plano(
      [linha('M', 'PRETO', { priceCents: 15900 }), linha('P'), linha('PP', 'Vermelho', { priceCents: 25900 })],
      existentes,
    );

    expect(issues).toEqual([]);
    // A cor com outra caixa é a mesma variante: o nome novo é gravado.
    expect(plan.update).toEqual([
      { id: 'm', data: expect.objectContaining({ color: 'PRETO', priceCents: 15900, sku: 'SKU-m' }) },
      { id: 'p-arquivada', data: expect.objectContaining({ size: 'P', sku: 'SKU-p-arquivada' }) },
    ]);
    expect(plan.create).toEqual([expect.objectContaining({ size: 'PP', sku: 'VESTIDO-MIDI-PP-VERMELHO', compareAtCents: null })]);
    // A arquivada que não voltou continua como está.
    expect(plan.archive).toEqual(['g']);
    expect(plan.colors).toEqual(['preto', 'vermelho']);
    expect(plan.minPriceCents).toBe(15900);
  });

  it('a grade vazia arquiva todas e zera o menor preço', () => {
    const { plan } = plano([], [gravada('m', 'M')]);
    expect([plan.archive, plan.minPriceCents]).toEqual([['m'], null]);
  });

  it('ordena pela grade de tamanhos e, no mesmo tamanho, pela cor', () => {
    const ordenadas = sortVariants('CLOTHING', [gravada('1', 'G'), gravada('2', 'PP', 'Vermelho'), gravada('3', 'PP', 'Azul')]);
    expect(ordenadas.map((v) => `${v.size}/${v.color}`)).toEqual(['PP/Azul', 'PP/Vermelho', 'G/Preto']);
  });
});
