import { createApiClient } from '@vitrine/api-client';
import { describe, expect, it } from 'vitest';

import {
  type ApplicationField,
  loadCategoryOptions,
  loadMyApplication,
  type MySellerApplication,
  sellerNavLink,
  submitSellerApplication,
} from './seller';

interface Chamada {
  method: string;
  url: string;
  body: unknown;
}

/** API de mentira: anota cada chamada e responde com o que o teste mandar, sem rede. */
function apiQue(responder: (req: Request) => Response | Promise<Response>) {
  const chamadas: Chamada[] = [];
  const api = createApiClient('http://api.teste', {
    fetch: async (req: Request) => {
      const text = await req.clone().text();
      chamadas.push({ method: req.method, url: req.url, body: text ? JSON.parse(text) : undefined });
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
  json({ type: `/problems/${code}`, title: 'Erro', status, detail, instance: '/v1/seller/application', code, ...extra }, status);

const CATEGORIA = '6f1c2a10-6a5e-4c4e-9a43-2a4f2b9d0c11';

/** O que a pessoa digitou no formulário de /vender. */
const digitado: Record<ApplicationField, string> = {
  storeName: 'Ateliê da Ana',
  slug: '',
  bio: 'Roupas autorais feitas à mão em Recife.',
  document: '111.444.777-35',
  mainCategoryId: CATEGORIA,
  instagram: '@atelie.ana',
  'pixKey.type': 'EMAIL',
  'pixKey.key': 'ana@exemplo.com',
};

const formulario = (valores: Partial<Record<ApplicationField, string>> = digitado) => {
  const form = new FormData();
  for (const [campo, valor] of Object.entries(valores)) form.set(campo, valor);
  return form;
};

const candidatura = (over: Partial<MySellerApplication> = {}): MySellerApplication => ({
  id: 'a9c7f0c4-7d71-4c47-9b8e-0b8b1f7c2d10',
  status: 'PENDING',
  storeName: 'Ateliê da Ana',
  slug: 'atelie-da-ana',
  bio: 'Roupas autorais feitas à mão em Recife.',
  instagram: 'atelie.ana',
  mainCategoryId: CATEGORIA,
  document: '***.444.777-**',
  pixKey: {
    type: 'EMAIL',
    key: 'ana@exemplo.com',
    ownerName: 'Ana Souza',
    ownerDocument: '***.444.777-**',
    verifiedAt: '2026-11-15T13:00:00.000Z',
  },
  appliedAt: '2026-11-15T13:00:00.000Z',
  approvedAt: null,
  rejection: null,
  suspension: null,
  checklist: { store: true, pixKey: true, shipping: false },
  ...over,
});

describe('US-022 — Candidatura pelo site (dados)', () => {
  // Dado: uma pessoa logada, sem loja
  // Quando: ela abre /vender, preenche o formulário e envia
  // Então: com sucesso, ela vai para /minha-loja
  it('AC-058: envia o que foi digitado para a API e, com sucesso, leva para /minha-loja @spec:AC-058', async () => {
    const { api, chamadas } = apiQue(() => json(candidatura(), 201));

    const resultado = await submitSellerApplication(api, formulario());

    expect(resultado).toEqual({ ok: true, redirectTo: '/minha-loja' });
    expect(chamadas).toEqual([
      {
        method: 'POST',
        url: 'http://api.teste/v1/seller/application',
        // Slug em branco não vai: a API sugere a partir do nome.
        body: {
          storeName: 'Ateliê da Ana',
          bio: 'Roupas autorais feitas à mão em Recife.',
          document: '111.444.777-35',
          mainCategoryId: CATEGORIA,
          instagram: '@atelie.ana',
          pixKey: { type: 'EMAIL', key: 'ana@exemplo.com' },
        },
      },
    ]);
  });

  // E: com erro, a mensagem aparece junto ao campo, e o que ela digitou continua no formulário
  it('AC-058: cada erro da API vira mensagem no campo certo, e o digitado volta para o formulário @spec:AC-058', async () => {
    const casos: { resposta: () => Response; campo: ApplicationField; mensagem: string }[] = [
      {
        resposta: () =>
          problem(
            422,
            'PIX_KEY_OWNER_MISMATCH',
            'Esta chave Pix não está no CPF/CNPJ da loja. Use uma chave da própria loja.',
          ),
        campo: 'pixKey.key',
        mensagem: 'Esta chave Pix não está no CPF/CNPJ da loja',
      },
      {
        resposta: () => problem(422, 'PIX_KEY_NOT_FOUND', 'Chave Pix não encontrada. Confira o tipo e a chave.'),
        campo: 'pixKey.key',
        mensagem: 'Chave Pix não encontrada',
      },
      {
        resposta: () =>
          problem(503, 'PIX_KEY_CHECK_UNAVAILABLE', 'Não conseguimos conferir a chave Pix agora. Tente de novo em alguns minutos.'),
        campo: 'pixKey.key',
        mensagem: 'Tente de novo em alguns minutos',
      },
      {
        resposta: () => problem(409, 'SLUG_TAKEN', 'O endereço "atelie-da-ana" já é usado por outra loja. Escolha outro.'),
        campo: 'slug',
        mensagem: 'já é usado por outra loja',
      },
      {
        resposta: () => problem(409, 'DOCUMENT_TAKEN', 'Este CPF/CNPJ já tem uma loja na Vitrine.'),
        campo: 'document',
        mensagem: 'Este CPF/CNPJ já tem uma loja na Vitrine.',
      },
      {
        // Sem o `detail`, vale a mensagem do site para o mesmo código.
        resposta: () => json({ status: 422, code: 'PIX_KEY_OWNER_MISMATCH' }, 422),
        campo: 'pixKey.key',
        mensagem: 'Esta chave Pix não está no CPF/CNPJ da loja',
      },
    ];

    for (const { resposta, campo, mensagem } of casos) {
      const { api } = apiQue(resposta);

      const resultado = await submitSellerApplication(api, formulario());

      expect(resultado.ok, campo).toBe(false);
      if (resultado.ok) continue;
      expect(resultado.state.fieldErrors[campo], campo).toContain(mensagem);
      expect(Object.keys(resultado.state.fieldErrors)).toEqual([campo]);
      expect(resultado.state.formError).toBeNull();
      expect(resultado.state.values).toEqual(digitado);
    }
  });

  it('AC-058: o 400 da API põe a mensagem de cada campo no próprio campo @spec:AC-058', async () => {
    const { api } = apiQue(() =>
      problem(400, 'VALIDATION_FAILED', 'Dados inválidos.', {
        errors: [
          { field: 'document', message: 'CPF ou CNPJ inválido. Confira os números.' },
          { field: 'mainCategoryId', message: 'Escolha uma categoria ativa.' },
          { field: 'pixKey.type', message: 'Use CPF, CNPJ, EMAIL, PHONE ou EVP.' },
        ],
      }),
    );
    const invalido = { ...digitado, document: '111.444.777-00', 'pixKey.type': '' };

    const resultado = await submitSellerApplication(api, formulario(invalido), {
      attempt: 2,
      values: {},
      fieldErrors: {},
      formError: null,
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.state).toEqual({
      attempt: 3,
      values: invalido,
      fieldErrors: {
        document: 'CPF ou CNPJ inválido. Confira os números.',
        mainCategoryId: 'Escolha uma categoria ativa.',
        'pixKey.type': 'Use CPF, CNPJ, EMAIL, PHONE ou EVP.',
      },
      formError: null,
    });
  });

  it('AC-058: conta que já tem loja, ou API fora do ar, mostra o aviso no formulário sem perder o digitado @spec:AC-058', async () => {
    const jaTem = apiQue(() =>
      problem(
        409,
        'SELLER_APPLICATION_EXISTS',
        'Sua candidatura foi recusada. Você pode se candidatar de novo a partir de 20/11/2026.',
        { canReapplyAt: '2026-11-20T15:00:00.000Z' },
      ),
    );
    const foraDoAr = apiQue(() => {
      throw new TypeError('fetch failed');
    });

    const recusada = await submitSellerApplication(jaTem.api, formulario());
    const semApi = await submitSellerApplication(foraDoAr.api, formulario());

    expect(recusada.ok || recusada.state).toMatchObject({
      fieldErrors: {},
      formError: expect.stringContaining('a partir de 20/11/2026'),
      values: digitado,
    });
    expect(semApi.ok || semApi.state).toMatchObject({
      fieldErrors: {},
      formError: expect.stringContaining('Tente de novo'),
      values: digitado,
    });
  });
});

describe('US-022 — Minha loja (dados)', () => {
  // Dado: uma pessoa logada
  // Quando: ela abre /minha-loja
  // Então: vê a situação da loja; sem loja (404), vê o convite para /vender
  it('AC-059: lê a candidatura da pessoa, e o 404 vira "sem loja" @spec:AC-059', async () => {
    const comLoja = apiQue(() => json(candidatura({ status: 'APPROVED' })));
    const semLoja = apiQue(() =>
      problem(404, 'SELLER_APPLICATION_NOT_FOUND', 'Você ainda não tem uma loja. Candidate-se em /vender.'),
    );
    const comErro = apiQue(() => json({ status: 500, detail: 'Erro inesperado.' }, 500));

    expect(await loadMyApplication(comLoja.api)).toEqual({
      kind: 'found',
      application: candidatura({ status: 'APPROVED' }),
    });
    expect(comLoja.chamadas.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET http://api.teste/v1/seller/application',
    ]);
    expect(await loadMyApplication(semLoja.api)).toEqual({ kind: 'none' });
    expect(await loadMyApplication(comErro.api)).toEqual({ kind: 'error', message: 'Erro inesperado.' });
  });

  it('o cabeçalho mostra "Minha loja" para quem tem candidatura e "Vender" para o resto', async () => {
    expect(await sellerNavLink(apiQue(() => json(candidatura())).api)).toEqual({
      href: '/minha-loja',
      label: 'Minha loja',
    });
    expect(await sellerNavLink(apiQue(() => problem(404, 'SELLER_APPLICATION_NOT_FOUND', 'Sem loja.')).api)).toEqual({
      href: '/vender',
      label: 'Vender',
    });
    const foraDoAr = apiQue(() => {
      throw new TypeError('fetch failed');
    });
    expect(await sellerNavLink(foraDoAr.api)).toEqual({ href: '/vender', label: 'Vender' });
  });

  it('as categorias do formulário vêm da árvore inteira, com o nível marcado', async () => {
    const node = (id: string, name: string, children: unknown[] = []) => ({
      id,
      name,
      slug: name.toLowerCase(),
      sizeType: 'CLOTHING',
      sizeChart: null,
      children,
    });
    const { api, chamadas } = apiQue(() =>
      json([node('f', 'Feminino', [node('v', 'Vestidos', [node('m', 'Midi')])]), node('c', 'Calçados')]),
    );

    expect(await loadCategoryOptions(api)).toEqual([
      { id: 'f', label: 'Feminino' },
      { id: 'v', label: '— Vestidos' },
      { id: 'm', label: '— — Midi' },
      { id: 'c', label: 'Calçados' },
    ]);
    expect(chamadas.map(({ url }) => url)).toEqual(['http://api.teste/v1/categories']);
    expect(await loadCategoryOptions(apiQue(() => json({ status: 500 }, 500)).api)).toEqual([]);
  });
});
