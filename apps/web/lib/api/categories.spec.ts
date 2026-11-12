import { createApiClient } from '@vitrine/api-client';
import { describe, expect, it } from 'vitest';

import { loadDepartments } from './categories';

const node = (name: string, slug: string, children: unknown[] = []) => ({
  id: crypto.randomUUID(),
  name,
  slug,
  sizeType: 'CLOTHING',
  sizeChart: null,
  children,
});

/** API de mentira: responde com o que o teste mandar, sem rede. */
const apiQue = (responder: (url: string) => Promise<Response>) =>
  createApiClient('http://api.teste', { fetch: (req: Request) => responder(req.url) });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('US-011 — Menu de departamentos (dados)', () => {
  // Dado: a árvore de categorias cadastrada
  // Quando: alguém abre qualquer página do site
  // Então: o cabeçalho mostra as categorias de primeiro nível, na ordem da árvore, com link para /c/{slug}
  it('AC-025: busca a árvore pública e devolve só o primeiro nível, na ordem da API @spec:AC-025', async () => {
    const chamadas: string[] = [];
    const api = apiQue(async (url) => {
      chamadas.push(url);
      return json([
        node('Feminino', 'feminino', [node('Vestidos', 'vestidos-femininos')]),
        node('Masculino', 'masculino'),
        node('Calçados', 'calcados'),
      ]);
    });

    const departamentos = await loadDepartments(api);

    expect(chamadas).toEqual(['http://api.teste/v1/categories']);
    expect(departamentos).toEqual([
      { name: 'Feminino', href: '/c/feminino' },
      { name: 'Masculino', href: '/c/masculino' },
      { name: 'Calçados', href: '/c/calcados' },
    ]);
  });

  // E: se a API não responder, o site abre normalmente, só sem o menu
  it('AC-025: API com erro, fora do ar ou lenta demais deixa o menu vazio, sem quebrar @spec:AC-025', async () => {
    const comErro = apiQue(async () => json({ status: 500, title: 'Internal Server Error' }, 500));
    const foraDoAr = apiQue(async () => {
      throw new TypeError('fetch failed');
    });
    const lenta = apiQue(
      (url) =>
        new Promise((_, reject) => {
          void url;
          setTimeout(() => reject(new Error('não deveria esperar tanto')), 10_000);
        }),
    );

    expect(await loadDepartments(comErro)).toEqual([]);
    expect(await loadDepartments(foraDoAr)).toEqual([]);
    const inicio = Date.now();
    expect(await loadDepartments(lenta, { timeoutMs: 50 })).toEqual([]);
    expect(Date.now() - inicio).toBeLessThan(2_000);
  });
});
