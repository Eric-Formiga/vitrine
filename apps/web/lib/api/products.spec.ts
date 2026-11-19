import { createApiClient } from '@vitrine/api-client';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_STEP_STATE,
  loadLeafCategories,
  loadMyProducts,
  loadProductEditor,
  publishProduct,
  requestUpload,
  saveImages,
  saveInfo,
  saveVariants,
  stepOf,
} from './products';

interface Chamada {
  method: string;
  url: string;
  ifMatch: string | null;
  body: unknown;
}

/** API de mentira: anota cada chamada (com o If-Match) e responde como o teste mandar. */
function apiQue(responder: (req: Request) => Response | Promise<Response>) {
  const chamadas: Chamada[] = [];
  const api = createApiClient('http://api.teste', {
    fetch: async (req: Request) => {
      const text = await req.clone().text();
      chamadas.push({ method: req.method, url: req.url, ifMatch: req.headers.get('if-match'), body: text ? JSON.parse(text) : undefined });
      return responder(req);
    },
  });
  return { api, chamadas };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

const problem = (status: number, code: string, detail: string, extra: Record<string, unknown> = {}) =>
  json({ type: `/problems/${code}`, title: 'Erro', status, detail, instance: '/v1/seller/products', code, ...extra }, status);

const ID = '0195a1b2-0000-7000-8000-0000000000aa';
const CATEGORIA = '0195a1b2-0000-7000-8000-0000000000cc';

const PRODUTO = {
  id: ID,
  slug: 'vestido-midi',
  title: 'Vestido Midi',
  description: 'Linho.',
  categoryId: CATEGORIA,
  condition: 'NEW',
  status: 'DRAFT',
  version: 3,
  minPriceCents: null,
  publishedAt: null,
  suspension: null,
  archivedAt: null,
  createdAt: '2026-11-19T12:00:00.000Z',
  updatedAt: '2026-11-19T12:00:00.000Z',
};

function formulario(campos: Record<string, string>): FormData {
  const form = new FormData();
  for (const [campo, valor] of Object.entries(campos)) form.set(campo, valor);
  return form;
}

const informacoes = { title: 'Vestido Midi', description: 'Linho.', categoryId: CATEGORIA, condition: 'NEW' };

describe('US-031 — O vendedor cadastra produtos pelo site (regras das etapas)', () => {
  // Dado: o formulário de produto
  // Quando: o vendedor passa pelas etapas informações → variantes → imagens → revisão
  // Então: cada etapa grava na API (a primeira cria o rascunho); os erros aparecem junto ao
  //        campo, e o que foi digitado continua no formulário
  // E: a revisão mostra o que falta para publicar ou publica
  it('AC-083: a primeira etapa cria o rascunho e leva para as variantes @spec:AC-083', async () => {
    const { api, chamadas } = apiQue(() => json(PRODUTO, 201));

    const result = await saveInfo(api, formulario(informacoes));

    expect(result).toEqual({ ok: true, redirectTo: `/minha-loja/produtos/${ID}?etapa=variantes` });
    expect(chamadas).toEqual([{ method: 'POST', url: 'http://api.teste/v1/seller/products', ifMatch: null, body: informacoes }]);
  });

  it('AC-083: cada etapa seguinte grava com a versão do produto (If-Match) e avança @spec:AC-083', async () => {
    const { api, chamadas } = apiQue((req) => {
      if (req.url.endsWith('/variants')) return json({ variants: [] });
      if (req.url.endsWith('/images')) return json({ images: [] });
      return json(PRODUTO);
    });
    const ref = { productId: ID, version: '3' };
    const linha = { size: 'M', color: 'Preto', colorHex: '#1A1A1A', price: '199,90', compareAt: '', stock: '5', weightGrams: '300', sku: '' };
    const foto = { path: `sellers/s/a.webp`, alt: 'Frente', color: null, url: 'https://x' };

    const info = await saveInfo(api, formulario({ ...informacoes, ...ref }));
    const grade = await saveVariants(api, formulario({ ...ref, payload: JSON.stringify([linha]) }));
    const fotos = await saveImages(api, formulario({ ...ref, payload: JSON.stringify([foto]) }));
    const publicado = await publishProduct(api, formulario(ref));

    expect([info, grade, fotos, publicado].map((r) => r.ok && r.redirectTo)).toEqual([
      `/minha-loja/produtos/${ID}?etapa=variantes`,
      `/minha-loja/produtos/${ID}?etapa=imagens`,
      `/minha-loja/produtos/${ID}?etapa=revisao`,
      '/minha-loja/produtos',
    ]);
    expect(chamadas.map((c) => `${c.method} ${c.url.replace('http://api.teste', '')} ${c.ifMatch}`)).toEqual([
      `PATCH /v1/seller/products/${ID} "3"`,
      `PUT /v1/seller/products/${ID}/variants "3"`,
      `PUT /v1/seller/products/${ID}/images "3"`,
      `POST /v1/seller/products/${ID}/publish "3"`,
    ]);
    expect(chamadas[1]?.body).toEqual({
      variants: [{ size: 'M', color: 'Preto', colorHex: '#1A1A1A', priceCents: 19990, compareAtCents: null, stock: 5, weightGrams: 300 }],
    });
    // Só o caminho, o texto alternativo e a cor vão para a API (a prévia fica no navegador).
    expect(chamadas[2]?.body).toEqual({ images: [{ path: 'sellers/s/a.webp', alt: 'Frente', color: null }] });
  });

  it('AC-083: os erros da API voltam junto ao campo, com o que foi digitado @spec:AC-083', async () => {
    const validacao = apiQue(() =>
      problem(400, 'VALIDATION_FAILED', 'Alguns campos estão inválidos.', {
        errors: [
          { field: 'title', message: 'Use pelo menos 3 caracteres.' },
          { field: 'categoryId', message: 'Escolha uma subcategoria de "Feminino" (a mais específica).' },
        ],
      }),
    );
    const info = await saveInfo(validacao.api, formulario({ ...informacoes, title: 'ab' }), { ...EMPTY_STEP_STATE, attempt: 1 });
    expect(info).toEqual({
      ok: false,
      state: {
        ...EMPTY_STEP_STATE,
        attempt: 2,
        values: { ...informacoes, title: 'ab' },
        fieldErrors: { title: 'Use pelo menos 3 caracteres.', categoryId: 'Escolha uma subcategoria de "Feminino" (a mais específica).' },
      },
    });

    const grade = apiQue(() =>
      problem(400, 'VALIDATION_FAILED', 'x', { errors: [{ field: 'variants.0.compareAtCents', message: 'O preço "de" precisa ser maior que o preço.' }] }),
    );
    const resultado = await saveVariants(grade.api, formulario({ productId: ID, version: '3', payload: '[]' }));
    expect(!resultado.ok && resultado.state.fieldErrors).toEqual({ 'variants.0.compareAtCents': 'O preço "de" precisa ser maior que o preço.' });

    // Preço que não é valor em reais nem chega à API.
    const local = apiQue(() => json({ variants: [] }));
    const linha = { size: 'M', color: 'Preto', colorHex: '#1A1A1A', price: 'caro', compareAt: '', stock: '5', weightGrams: '300', sku: '' };
    const recusada = await saveVariants(local.api, formulario({ productId: ID, version: '3', payload: JSON.stringify([linha]) }));
    expect(!recusada.ok && recusada.state.fieldErrors).toEqual({ 'variants.0.priceCents': 'Informe o preço em reais, ex.: 199,90.' });
    expect(local.chamadas).toEqual([]);

    const imagem = apiQue(() => problem(422, 'INVALID_IMAGE', 'Imagem 2: O arquivo não chegou ao Storage. Envie de novo.', { position: 1, reason: 'missing' }));
    const foto = await saveImages(imagem.api, formulario({ productId: ID, version: '3', payload: '[]' }));
    expect(!foto.ok && foto.state.fieldErrors).toEqual({ 'images.1': 'Imagem 2: O arquivo não chegou ao Storage. Envie de novo.' });
  });

  it('AC-083: publicar o incompleto devolve o que falta @spec:AC-083', async () => {
    const { api } = apiQue(() => problem(422, 'PRODUCT_NOT_PUBLISHABLE', 'O produto precisa de pelo menos uma foto.', { missing: ['images', 'stock'] }));
    const result = await publishProduct(api, formulario({ productId: ID, version: '3' }));
    expect(!result.ok && [result.state.missing, result.state.formError]).toEqual([['images', 'stock'], 'O produto precisa de pelo menos uma foto.']);
  });

  // Dado: o produto alterado em outra aba depois que o formulário foi aberto
  // Quando: o vendedor grava uma etapa
  // Então: aparece o aviso de conflito; o que estava digitado não se perde
  it('AC-086: versão desatualizada vira o aviso de conflito, com o digitado preservado @spec:AC-086', async () => {
    const { api } = apiQue(() => problem(412, 'PRODUCT_VERSION_CONFLICT', 'Este produto mudou.', { currentVersion: 4 }));
    const digitado = { ...informacoes, title: 'Vestido Midi Off-White' };

    const info = await saveInfo(api, formulario({ ...digitado, productId: ID, version: '3' }));
    const grade = await saveVariants(api, formulario({ productId: ID, version: '3', payload: '[]' }));
    const publicar = await publishProduct(api, formulario({ productId: ID, version: '3' }));

    expect(info).toEqual({ ok: false, state: { ...EMPTY_STEP_STATE, attempt: 1, values: digitado, conflict: true } });
    for (const result of [grade, publicar]) expect(!result.ok && result.state.conflict).toBe(true);
  });

  it('API fora do ar ou sessão expirada viram aviso no topo', async () => {
    const fora = apiQue(() => {
      throw new TypeError('fetch failed');
    });
    const semSessao = apiQue(() => problem(401, 'UNAUTHORIZED', 'Faça login.'));
    const a = await saveInfo(fora.api, formulario(informacoes));
    const b = await saveInfo(semSessao.api, formulario(informacoes));
    expect(!a.ok && a.state.formError).toBe('Não conseguimos falar com a Vitrine agora. Tente de novo em instantes.');
    expect(!a.ok && a.state.values).toEqual(informacoes);
    expect(!b.ok && b.state.formError).toBe('Sua sessão expirou. Entre de novo para gravar.');
  });
});

describe('US-031 — Carregar as telas de produtos', () => {
  it('AC-082: a lista só existe para a loja aprovada (404 ou 403 = não aprovada) @spec:AC-082', async () => {
    const lista = [{ id: ID, slug: 'v', title: 'Vestido', status: 'DRAFT', version: 1, coverUrl: null, minPriceCents: null, totalStock: 0, suspension: null, createdAt: '', updatedAt: '' }];
    expect(await loadMyProducts(apiQue(() => json(lista)).api)).toEqual({ kind: 'ok', products: lista });
    expect(await loadMyProducts(apiQue(() => problem(404, 'NOT_FOUND', 'x')).api)).toEqual({ kind: 'not-approved' });
    expect(await loadMyProducts(apiQue(() => problem(403, 'SELLER_NOT_ACTIVE', 'x')).api)).toEqual({ kind: 'not-approved' });
    expect(await loadMyProducts(apiQue(() => problem(500, 'INTERNAL', 'Falhou.')).api)).toEqual({ kind: 'error', message: 'Falhou.' });
  });

  it('o formulário abre com o produto, a grade e as fotos; de outra loja, 404', async () => {
    const { api } = apiQue((req) => {
      if (req.url.endsWith('/variants')) return json({ variants: [] });
      if (req.url.endsWith('/images')) return json({ images: [] });
      return json(PRODUTO);
    });
    expect(await loadProductEditor(api, ID)).toEqual({ kind: 'ok', product: PRODUTO, variants: [], images: [] });
    expect(await loadProductEditor(apiQue(() => problem(404, 'PRODUCT_NOT_FOUND', 'x')).api, ID)).toEqual({ kind: 'not-found' });
  });

  it('só as categorias sem subcategorias aparecem, com o caminho e o tipo de tamanho', async () => {
    const no = (id: string, name: string, sizeType: string, children: unknown[] = []) => ({ id, name, slug: id, sizeType, sizeChart: null, children });
    const { api } = apiQue(() => json([no('f', 'Feminino', 'CLOTHING', [no('v', 'Vestidos', 'CLOTHING'), no('c', 'Calçados', 'SHOES')]), no('b', 'Bolsas', 'ONE_SIZE')]));
    expect(await loadLeafCategories(api)).toEqual([
      { id: 'v', label: 'Feminino › Vestidos', sizeType: 'CLOTHING' },
      { id: 'c', label: 'Feminino › Calçados', sizeType: 'SHOES' },
      { id: 'b', label: 'Bolsas', sizeType: 'ONE_SIZE' },
    ]);
  });

  it('pede a URL de upload com o tipo e o tamanho do arquivo já reduzido', async () => {
    const { api, chamadas } = apiQue(() => json({ path: 'sellers/s/a.webp', uploadUrl: 'https://storage.test/u', expiresAt: '2026-11-19T14:00:00.000Z' }, 201));
    expect(await requestUpload(api, { contentType: 'image/webp', sizeBytes: 1234 })).toEqual({ ok: true, path: 'sellers/s/a.webp', uploadUrl: 'https://storage.test/u' });
    expect(chamadas[0]?.body).toEqual({ contentType: 'image/webp', sizeBytes: 1234 });
    expect(stepOf('imagens')).toBe('imagens');
    expect(stepOf('qualquer')).toBe('informacoes');
  });
});
