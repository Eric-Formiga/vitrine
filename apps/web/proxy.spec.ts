import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { guardPrivateRoutes } from './proxy';

type Sessao = () => Promise<{ userId: string | null }>;

const semSessao: Sessao = async () => ({ userId: null });
const comSessao: Sessao = async () => ({ userId: 'user_ana' });

const abrir = (path: string, auth = semSessao) => guardPrivateRoutes(auth, new NextRequest(`http://localhost:3000${path}`));

describe('US-004 — O site protege as áreas privadas', () => {
  // Dado: um visitante sem sessão
  // Quando: ele abre uma área privada do site (/conta, /seller ou /admin)
  // Então: é levado para a página de login
  // E: o link de login guarda o endereço da página que ele tentou abrir
  it('AC-009: área privada leva ao login guardando o endereço de volta @spec:AC-009', async () => {
    for (const path of ['/conta', '/conta/pedidos', '/seller', '/seller/produtos', '/admin']) {
      const res = await abrir(path);

      expect(res?.status).toBe(307);
      const destino = new URL(res!.headers.get('location')!);
      expect(destino.pathname).toBe('/sign-in');
      expect(destino.searchParams.get('redirect_url')).toBe(`http://localhost:3000${path}`);
    }
  });

  // Dado: um visitante sem sessão
  // Quando: ele abre uma página pública (/, /busca, /c/... ou /loja/...)
  // Então: o site não pede login
  it('AC-010: páginas públicas abrem sem login @spec:AC-010', async () => {
    for (const path of ['/', '/busca?q=camisa', '/c/vestidos', '/loja/brecho-da-ana', '/sign-in', '/contato']) {
      expect(await abrir(path)).toBeUndefined();
    }
  });

  it('quem está logado entra nas áreas privadas', async () => {
    expect(await abrir('/conta', comSessao)).toBeUndefined();
  });
});

describe('US-022 — As telas do vendedor exigem login', () => {
  // Dado: um visitante sem sessão
  // Quando: ele abre /minha-loja (ou /vender)
  // Então: vai para o login, como as outras áreas privadas
  it('AC-059: /minha-loja e /vender sem login levam ao login guardando o endereço de volta @spec:AC-059 @spec:AC-058', async () => {
    for (const path of ['/minha-loja', '/vender']) {
      const res = await abrir(path);

      expect(res?.status, path).toBe(307);
      const destino = new URL(res!.headers.get('location')!);
      expect(destino.pathname).toBe('/sign-in');
      expect(destino.searchParams.get('redirect_url')).toBe(`http://localhost:3000${path}`);
    }
  });

  it('AC-059: logado, a pessoa abre /minha-loja e /vender @spec:AC-059 @spec:AC-058', async () => {
    expect(await abrir('/minha-loja', comSessao)).toBeUndefined();
    expect(await abrir('/vender', comSessao)).toBeUndefined();
  });
});
