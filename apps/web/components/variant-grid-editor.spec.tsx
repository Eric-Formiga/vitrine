import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EMPTY_STEP_STATE, type StepState } from '../lib/api/products';
import { generateRows } from '../lib/products/variant-grid';
import { VariantGridEditor } from './variant-grid-editor';

const parada = async (state: StepState) => state;

const LINHAS = generateRows('CLOTHING', ['P', 'M'], [{ name: 'Preto', hex: '#1A1A1A' }, { name: 'Azul', hex: '#1E3A8A' }], []).map((row) =>
  row.size === 'M' && row.color === 'Preto' ? { ...row, price: '199,90', stock: '7', weightGrams: '300' } : row,
);

const render = (state: StepState = EMPTY_STEP_STATE, sizeType: 'CLOTHING' | 'SHOES' = 'CLOTHING', rows = LINHAS) =>
  renderToStaticMarkup(<VariantGridEditor productId="p1" version={3} sizeType={sizeType} initialRows={rows} action={parada} initialState={state} />);

const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('US-031 — Editor da grade', () => {
  // Dado: a etapa de variantes de um produto de roupas
  // Quando: o vendedor marca os tamanhos e as cores
  // Então: uma linha por combinação, com preço, preço "de", estoque, peso e SKU
  it('AC-084: tamanhos da categoria, cores e uma linha por combinação @spec:AC-084', () => {
    const html = render();

    // Os tamanhos da lista de roupas, com os da grade marcados.
    const tamanhos = [...html.matchAll(/<input type="checkbox" data-size="(\w+)"( checked="")?/g)].map(([, size, marcado]) => `${size}${marcado ? '*' : ''}`);
    expect(tamanhos).toEqual(['PP', 'P*', 'M*', 'G', 'GG', 'XGG']);
    expect([...html.matchAll(/<li data-color="([^"]+)"/g)].map(([, cor]) => cor)).toEqual(['Preto', 'Azul']);
    expect([...html.matchAll(/<tr data-row="([^"]+)"/g)].map(([, linha]) => linha)).toEqual(['P/Preto', 'P/Azul', 'M/Preto', 'M/Azul']);
    expect(html).toMatch(/aria-label="Preço \(R\$\), M Preto"[^>]*value="199,90"/);
    expect(html).toMatch(/aria-label="Estoque, M Preto"[^>]*value="7"/);
    for (const coluna of ['Preço (R$)', 'Preço &quot;de&quot; (R$)', 'Estoque', 'Peso (g)', 'SKU (opcional)']) expect(html).toContain(`>${coluna}</th>`);

    // A grade inteira vai para a Server Action num campo oculto, com a versão.
    const payload = html.match(/name="payload" value="([^"]*)"/)?.[1];
    expect(JSON.parse(decode(payload ?? '[]'))).toEqual(LINHAS);
    expect(html).toContain('name="version" value="3"');
  });

  it('AC-084: calçados usam os tamanhos de 33 a 46 @spec:AC-084', () => {
    const html = render(EMPTY_STEP_STATE, 'SHOES', []);
    const tamanhos = [...html.matchAll(/data-size="(\w+)"/g)].map(([, size]) => size);
    expect(tamanhos[0]).toBe('33');
    expect(tamanhos.at(-1)).toBe('46');
    expect(html).toContain('Marque pelo menos um tamanho e adicione uma cor');
  });

  it('AC-083: o erro da API aparece na célula da linha certa @spec:AC-083', () => {
    const html = render({ ...EMPTY_STEP_STATE, fieldErrors: { 'variants.2.priceCents': 'O preço precisa ser maior que zero.' } });

    expect(html).toMatch(/aria-label="Preço \(R\$\), M Preto"[^>]*aria-invalid="true"[^>]*aria-describedby="field-variants-2-priceCents-error"/);
    expect(html).toContain('<p id="field-variants-2-priceCents-error" class="text-sm text-red-700 dark:text-red-400">O preço precisa ser maior que zero.</p>');
  });
});
