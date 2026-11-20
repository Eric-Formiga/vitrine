import { describe, expect, it } from 'vitest';

import {
  formatReais,
  generateRows,
  type GridRow,
  parseReais,
  rowsFromVariants,
  selectionOf,
  SIZE_GRID,
  toVariantInputs,
} from './variant-grid';

const PRETO = { name: 'Preto', hex: '#1A1A1A' };
const AZUL = { name: 'Azul', hex: '#1E3A8A' };

const combinacoes = (rows: GridRow[]) => rows.map((row) => `${row.size}/${row.color}`);

describe('US-031 — Gerador de grade', () => {
  // Dado: a etapa de variantes de um produto de roupas
  // Quando: o vendedor marca os tamanhos (da lista da categoria) e adiciona cores
  // Então: a tabela ganha uma linha por combinação de tamanho × cor
  // E: marcar ou desmarcar mantém os valores digitados nas linhas que continuam
  it('AC-084: uma linha por tamanho × cor, na ordem da grade @spec:AC-084', () => {
    const rows = generateRows('CLOTHING', ['G', 'P', 'M'], [PRETO, AZUL], []);

    expect(combinacoes(rows)).toEqual(['P/Preto', 'P/Azul', 'M/Preto', 'M/Azul', 'G/Preto', 'G/Azul']);
    expect(rows[0]).toEqual({ size: 'P', color: 'Preto', colorHex: '#1A1A1A', price: '', compareAt: '', stock: '0', weightGrams: '', sku: '' });
    // Tamanho fora da lista da categoria não entra; cor repetida (sem diferenciar maiúsculas) também não.
    expect(combinacoes(generateRows('CLOTHING', ['M', '38'], [PRETO, { name: 'preto', hex: '#000000' }, { name: ' ', hex: '#FFFFFF' }], []))).toEqual([
      'M/Preto',
    ]);
    expect(SIZE_GRID.SHOES).toEqual(['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']);
    expect(combinacoes(generateRows('ONE_SIZE', ['U'], [PRETO], []))).toEqual(['U/Preto']);
  });

  it('AC-084: marcar e desmarcar mantém o que já foi digitado nas combinações que continuam @spec:AC-084', () => {
    const inicio = generateRows('CLOTHING', ['P', 'M'], [PRETO], []);
    const digitado = inicio.map((row) => (row.size === 'M' ? { ...row, price: '199,90', stock: '7', weightGrams: '300', sku: 'VEST-M' } : row));

    const comG = generateRows('CLOTHING', ['P', 'M', 'G'], [PRETO], digitado);
    const semP = generateRows('CLOTHING', ['M', 'G'], [PRETO], comG);
    const comAzul = generateRows('CLOTHING', ['M', 'G'], [{ ...PRETO, hex: '#000000' }, AZUL], semP);

    expect(combinacoes(comAzul)).toEqual(['M/Preto', 'M/Azul', 'G/Preto', 'G/Azul']);
    expect(comAzul[0]).toMatchObject({ price: '199,90', stock: '7', weightGrams: '300', sku: 'VEST-M', colorHex: '#000000' });
    expect(comAzul[1]).toMatchObject({ price: '', stock: '0' });
    // Desmarcar e marcar de novo: a linha volta vazia (o valor foi junto com a combinação).
    expect(generateRows('CLOTHING', ['P', 'M'], [PRETO], semP)[0]).toMatchObject({ size: 'P', price: '' });
  });

  it('a grade salva volta como linhas, com tamanhos e cores marcados', () => {
    const rows = rowsFromVariants([
      { id: 'a', sku: 'VEST-M-PRETO', size: 'M', color: 'Preto', colorHex: '#1A1A1A', priceCents: 19990, compareAtCents: 25900, stock: 3, reserved: 0, weightGrams: 300 },
      { id: 'b', sku: 'VEST-G-AZUL', size: 'G', color: 'Azul', colorHex: '#1E3A8A', priceCents: 20000, compareAtCents: null, stock: 0, reserved: 0, weightGrams: 320 },
    ]);
    expect(rows[0]).toEqual({ size: 'M', color: 'Preto', colorHex: '#1A1A1A', price: '199,90', compareAt: '259,00', stock: '3', weightGrams: '300', sku: 'VEST-M-PRETO' });
    expect(rows[1]?.compareAt).toBe('');
    expect(selectionOf(rows)).toEqual({ sizes: ['M', 'G'], colors: [PRETO, AZUL] });
  });

  it('converte reais em centavos e aponta o campo que não converte, sem chamar a API', () => {
    expect([parseReais('199,90'), parseReais('199.9'), parseReais('R$ 1.299,90'), parseReais('35')]).toEqual([19990, 19990, 129990, 3500]);
    expect([parseReais(''), parseReais('abc'), parseReais('1,999')]).toEqual([null, null, null]);
    expect(formatReais(129990)).toBe('1299,90');

    const [ok] = generateRows('CLOTHING', ['M'], [PRETO], []).map((row) => ({ ...row, price: '199,90', compareAt: '259', stock: '5', weightGrams: '300' }));
    expect(toVariantInputs([ok!])).toEqual({
      variants: [{ size: 'M', color: 'Preto', colorHex: '#1A1A1A', priceCents: 19990, compareAtCents: 25900, stock: 5, weightGrams: 300 }],
      errors: {},
    });
    const ruim = { ...ok!, price: 'caro', compareAt: 'x', stock: '-1', weightGrams: '0,3' };
    expect(Object.keys(toVariantInputs([ok!, ruim]).errors)).toEqual([
      'variants.1.priceCents',
      'variants.1.compareAtCents',
      'variants.1.stock',
      'variants.1.weightGrams',
    ]);
  });
});
