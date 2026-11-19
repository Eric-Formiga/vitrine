import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EMPTY_STEP_STATE, type ProductImage, type SellerProduct, type SellerVariant, type Step, type StepState } from '../lib/api/products';
import { ProductForm, type ProductFormActions } from './product-form';

const parada = async (state: StepState) => state;
const ACOES: ProductFormActions = {
  saveInfo: parada,
  saveVariants: parada,
  saveImages: parada,
  publish: parada,
  requestUpload: async () => ({ ok: false, message: 'x' }),
};

const CATEGORIAS = [
  { id: 'v', label: 'Feminino › Vestidos', sizeType: 'CLOTHING' as const },
  { id: 't', label: 'Calçados › Tênis', sizeType: 'SHOES' as const },
];

const PRODUTO: SellerProduct = {
  id: 'p1',
  slug: 'vestido-midi',
  title: 'Vestido Midi',
  description: 'Linho lavado.',
  categoryId: 'v',
  condition: 'NEW',
  status: 'DRAFT',
  version: 3,
  minPriceCents: 19990,
  publishedAt: null,
  suspension: null,
  archivedAt: null,
  createdAt: '2026-11-19T12:00:00.000Z',
  updatedAt: '2026-11-19T12:00:00.000Z',
};

const VARIANTE: SellerVariant = {
  id: 'v1',
  sku: 'VEST-M-PRETO',
  size: 'M',
  color: 'Preto',
  colorHex: '#1A1A1A',
  priceCents: 19990,
  compareAtCents: null,
  stock: 4,
  reserved: 0,
  weightGrams: 300,
};

const FOTO: ProductImage = { path: 'sellers/s/a.webp', url: 'https://x.supabase.co/a.webp', alt: 'Frente', color: null, position: 0 };

const render = (
  step: Step,
  {
    product = PRODUTO,
    variants = [VARIANTE],
    images = [FOTO],
    state = EMPTY_STEP_STATE,
  }: { product?: SellerProduct | null; variants?: SellerVariant[]; images?: ProductImage[]; state?: StepState } = {},
) =>
  renderToStaticMarkup(
    <ProductForm step={step} product={product} variants={variants} images={images} categories={CATEGORIAS} actions={ACOES} initialState={state} />,
  );

const atributo = (tag: string, nome: string) => tag.match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1];
const controle = (html: string, name: string) => html.match(new RegExp(`<(input|textarea|select)\\b[^>]*\\bname="${name}"[^>]*>`))?.[0] ?? '';

describe('US-031 — Formulário em etapas', () => {
  // Dado: o formulário de produto (/minha-loja/produtos/novo e /minha-loja/produtos/{id})
  // Quando: o vendedor passa pelas etapas informações → variantes → imagens → revisão
  // Então: cada etapa grava na API (a primeira cria o rascunho); os erros aparecem junto ao campo
  // E: a revisão mostra o que falta para publicar ou o botão "Publicar"
  it('AC-083: as quatro etapas, com a atual marcada; o produto novo só tem a primeira @spec:AC-083', () => {
    const novo = render('variantes', { product: null, variants: [], images: [] });
    const existente = render('imagens');

    expect(novo).toContain('Novo produto');
    expect(novo).toContain('aria-current="step"');
    expect(novo).toMatch(/aria-current="step"[^>]*>1\. Informações</);
    expect(novo).toContain('Criar rascunho e continuar');
    expect(novo).not.toContain('name="productId"');
    expect(novo).not.toContain('href="/minha-loja/produtos/p1');

    expect(existente).toMatch(/aria-current="step"[^>]*>3\. Imagens</);
    for (const etapa of ['informacoes', 'variantes', 'revisao']) {
      expect(existente).toContain(`href="/minha-loja/produtos/p1?etapa=${etapa}"`);
    }
  });

  it('AC-083: as informações abrem com o gravado e levam a versão para o If-Match @spec:AC-083', () => {
    const html = render('informacoes');

    expect(atributo(controle(html, 'title'), 'value')).toBe('Vestido Midi');
    expect(html).toMatch(/<textarea[^>]*name="description"[^>]*>Linho lavado\.<\/textarea>/);
    expect(html).toMatch(/<option value="v" selected="">Feminino › Vestidos<\/option>/);
    expect(atributo(controle(html, 'productId'), 'value')).toBe('p1');
    expect(atributo(controle(html, 'version'), 'value')).toBe('3');
  });

  it('AC-083: com erro, a mensagem fica junto ao campo e o digitado continua @spec:AC-083', () => {
    const html = render('informacoes', {
      state: {
        ...EMPTY_STEP_STATE,
        attempt: 1,
        values: { title: 'ab', description: 'Nova descrição', categoryId: 't', condition: 'USED' },
        fieldErrors: { title: 'Use pelo menos 3 caracteres.' },
      },
    });

    const titulo = controle(html, 'title');
    expect(atributo(titulo, 'value')).toBe('ab');
    expect(atributo(titulo, 'aria-invalid')).toBe('true');
    expect(html).toContain(`<p id="${atributo(titulo, 'aria-describedby')}" class="text-sm text-red-700 dark:text-red-400">Use pelo menos 3 caracteres.</p>`);
    expect(html).toMatch(/<option value="t" selected="">Calçados › Tênis<\/option>/);
    expect(html).toMatch(/<option value="USED" selected="">Usado<\/option>/);
  });

  it('AC-083: a revisão mostra o que falta ou o botão "Publicar" @spec:AC-083', () => {
    const completo = render('revisao');
    const semNada = render('revisao', { variants: [{ ...VARIANTE, stock: 0 }], images: [] });
    const peloApi = render('revisao', { state: { ...EMPTY_STEP_STATE, missing: ['images'], formError: 'O produto precisa de pelo menos uma foto.' } });
    const publicado = render('revisao', { product: { ...PRODUTO, status: 'ACTIVE' } });

    expect(completo).toMatch(/<button[^>]*type="submit"[^>]*>Publicar<\/button>/);
    expect(completo).not.toContain('Falta para publicar');
    expect([...semNada.matchAll(/data-gap="(\w+)"/g)].map(([, gap]) => gap)).toEqual(['images', 'stock']);
    expect(semNada).not.toContain('>Publicar<');
    expect([...peloApi.matchAll(/data-gap="(\w+)"/g)].map(([, gap]) => gap)).toEqual(['images']);
    expect(publicado).toContain('já saiu do rascunho');
    expect(publicado).not.toContain('>Publicar<');
  });

  // Dado: o produto alterado em outra aba depois que o formulário foi aberto
  // Quando: o vendedor grava uma etapa
  // Então: aparece o aviso de que o produto mudou, com "Recarregar"; o digitado não se perde até recarregar
  it('AC-086: conflito de versão mostra o aviso com "Recarregar" e mantém o digitado @spec:AC-086', () => {
    const digitado = { title: 'Vestido Off-White', description: 'Outra', categoryId: 'v', condition: 'NEW' };
    const info = render('informacoes', { state: { ...EMPTY_STEP_STATE, attempt: 1, values: digitado, conflict: true } });
    const grade = render('variantes', { state: { ...EMPTY_STEP_STATE, conflict: true } });

    expect(info).toMatch(/role="alert" data-conflict="true"[^>]*><p>Este produto mudou em outra aba/);
    expect(info).toContain('<a href="/minha-loja/produtos/p1?etapa=informacoes" class="font-medium text-primary underline">Recarregar</a>');
    expect(atributo(controle(info, 'title'), 'value')).toBe('Vestido Off-White');
    expect(grade).toContain('href="/minha-loja/produtos/p1?etapa=variantes"');
    expect(grade).toContain('data-conflict="true"');
    expect(render('informacoes')).not.toContain('data-conflict');
  });
});
