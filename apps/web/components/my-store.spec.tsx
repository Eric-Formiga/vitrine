import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { MySellerApplication } from '../lib/api/seller';
import { MyStore } from './my-store';

const candidatura = (over: Partial<MySellerApplication> = {}): MySellerApplication => ({
  id: 'a9c7f0c4-7d71-4c47-9b8e-0b8b1f7c2d10',
  status: 'PENDING',
  storeName: 'Ateliê da Ana',
  slug: 'atelie-da-ana',
  bio: 'Roupas autorais feitas à mão em Recife.',
  instagram: 'atelie.ana',
  mainCategoryId: '6f1c2a10-6a5e-4c4e-9a43-2a4f2b9d0c11',
  document: '***.444.777-**',
  pixKey: {
    type: 'EMAIL',
    key: 'ana@exemplo.com',
    ownerName: 'Ana Souza',
    ownerDocument: '***.444.777-**',
    verifiedAt: '2026-11-10T13:00:00.000Z',
  },
  appliedAt: '2026-11-10T13:00:00.000Z',
  approvedAt: null,
  rejection: null,
  suspension: null,
  checklist: { store: true, pixKey: true, shipping: false },
  ...over,
});

const HOJE = new Date('2026-11-15T15:00:00.000Z');

/** Texto visível, sem as tags, com os espaços normalizados. */
const texto = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const links = (html: string) =>
  [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(([, href, nome]) => [nome, href]);

const render = (application: MySellerApplication | null, now = HOJE) =>
  renderToStaticMarkup(<MyStore application={application} now={now} />);

describe('US-022 — Minha loja (tela)', () => {
  // Dado: uma pessoa logada
  // Quando: ela abre /minha-loja
  // Então: vê a situação da loja, o titular da chave Pix conferida e o checklist
  it('AC-059: loja em análise mostra a situação, o titular da chave Pix conferida e o checklist @spec:AC-059', () => {
    const tela = texto(render(candidatura()));

    expect(tela).toContain('Situação: Em análise');
    expect(tela).toContain('Titular da chave Ana Souza (***.444.777-**)');
    expect(tela).toContain('Conferido no Asaas em 10/11/2026');
    expect(tela).toContain('Chave Pix E-mail: ana@exemplo.com');
    expect(tela).toMatch(/Dados da loja: pronto .*Chave Pix: pronto .*Frete: pendente/);
  });

  it('AC-059: cada situação aparece com o nome certo, e a suspensa mostra o motivo @spec:AC-059', () => {
    expect(texto(render(candidatura({ status: 'APPROVED', approvedAt: '2026-11-12T13:00:00.000Z' })))).toContain(
      'Situação: Aprovada',
    );

    const suspensa = texto(
      render(
        candidatura({
          status: 'SUSPENDED',
          suspension: { reason: 'Fotos de produtos de outra loja.', suspendedAt: '2026-11-14T13:00:00.000Z' },
        }),
      ),
    );
    expect(suspensa).toContain('Situação: Suspensa');
    expect(suspensa).toContain('Motivo: Fotos de produtos de outra loja.');
    expect(suspensa).toContain('Suspensa em 14/11/2026');
  });

  it('AC-059: loja rejeitada mostra o motivo e a data para tentar de novo @spec:AC-059', () => {
    const rejeitada = candidatura({
      status: 'REJECTED',
      rejection: {
        reason: 'A bio não descreve o que a loja vende.',
        rejectedAt: '2026-11-13T15:00:00.000Z',
        canReapplyAt: '2026-11-20T15:00:00.000Z',
      },
    });

    const antesDoPrazo = render(rejeitada);
    expect(texto(antesDoPrazo)).toContain('Situação: Rejeitada');
    expect(texto(antesDoPrazo)).toContain('Motivo: A bio não descreve o que a loja vende.');
    expect(texto(antesDoPrazo)).toContain('Você pode se candidatar de novo a partir de 20/11/2026.');
    expect(links(antesDoPrazo)).toEqual([]);

    // Passado o prazo, o convite para uma nova candidatura aparece.
    const depoisDoPrazo = render(rejeitada, new Date('2026-11-20T15:00:00.000Z'));
    expect(links(depoisDoPrazo)).toEqual([['Enviar nova candidatura', '/vender']]);
  });

  // E: sem loja, vê um convite com link para /vender
  it('AC-059: sem loja, mostra o convite com link para /vender @spec:AC-059', () => {
    const html = render(null);

    expect(texto(html)).toContain('Você ainda não tem uma loja na Vitrine.');
    expect(links(html)).toEqual([['Quero vender na Vitrine', '/vender']]);
    expect(texto(html)).not.toContain('Situação');
  });
});
