import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { SellerProductSummary } from '../lib/api/products';
import { ProductList } from './product-list';

const produto = (extra: Partial<SellerProductSummary>): SellerProductSummary => ({
  id: 'p1',
  slug: 'vestido',
  title: 'Vestido Midi',
  status: 'DRAFT',
  version: 1,
  coverUrl: null,
  minPriceCents: null,
  totalStock: 0,
  suspension: null,
  createdAt: '2026-11-19T12:00:00.000Z',
  updatedAt: '2026-11-19T12:00:00.000Z',
  ...extra,
});

/** O trecho da lista de um produto. */
const item = (html: string, id: string) => html.match(new RegExp(`<li data-product="${id}"[^>]*>(.*?)</li>`))?.[1] ?? '';

describe('US-031 — Página "Meus produtos"', () => {
  // Dado: um vendedor com loja aprovada, com e sem produtos
  // Quando: ele abre /minha-loja/produtos
  // Então: vê cada produto com capa, título, situação (suspenso com o motivo), menor preço e estoque, e "Novo produto"
  // E: sem produtos, o convite; com a loja não aprovada, o aviso
  it('AC-082: cada produto com capa, título, situação, menor preço e estoque @spec:AC-082', () => {
    const html = renderToStaticMarkup(
      <ProductList
        approved
        products={[
          produto({ id: 'ativo', title: 'Vestido Midi', status: 'ACTIVE', coverUrl: 'https://x.supabase.co/capa.webp', minPriceCents: 19990, totalStock: 12 }),
          produto({
            id: 'suspenso',
            title: 'Saia',
            status: 'SUSPENDED',
            suspension: { reason: 'Foto de outra loja.', suspendedAt: '2026-11-18T10:00:00.000Z' },
          }),
          produto({ id: 'rascunho', title: 'Blusa' }),
          produto({ id: 'arquivado', title: 'Casaco', status: 'ARCHIVED' }),
        ]}
      />,
    );

    const ativo = item(html, 'ativo');
    expect(ativo).toContain('<img src="https://x.supabase.co/capa.webp"');
    expect(ativo).toContain('>Vestido Midi</a>');
    expect(ativo).toContain('href="/minha-loja/produtos/ativo?etapa=informacoes"');
    expect(ativo).toContain('<strong data-status="ACTIVE">Ativo</strong>');
    expect(ativo).toContain('<dd data-field="price">R$ 199,90</dd>');
    expect(ativo).toContain('<dd data-field="stock">12</dd>');
    expect(item(html, 'suspenso')).toMatch(/Suspenso<\/strong><span[^>]*> — motivo: Foto de outra loja\.<\/span>/);
    expect(item(html, 'rascunho')).toContain('>Rascunho</strong>');
    expect(item(html, 'rascunho')).toContain('<dd data-field="price">—</dd>');
    expect(item(html, 'arquivado')).toContain('>Arquivado</strong>');
    expect(html).toContain('href="/minha-loja/produtos/novo"');
    expect(html).toContain('>Novo produto</a>');
  });

  it('AC-082: sem produtos, o convite; sem loja aprovada, o aviso @spec:AC-082', () => {
    const vazia = renderToStaticMarkup(<ProductList approved products={[]} />);
    const naoAprovada = renderToStaticMarkup(<ProductList approved={false} products={[]} />);

    expect(vazia).toContain('Você ainda não cadastrou nenhum produto.');
    expect(vazia).toContain('>Novo produto</a>');
    expect(naoAprovada).toContain('Só a loja aprovada cadastra produtos.');
    expect(naoAprovada).not.toContain('Novo produto');
  });
});
