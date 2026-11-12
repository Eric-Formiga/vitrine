import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CategoryMenu } from './category-menu';

describe('US-011 — Menu de departamentos (tela)', () => {
  // Dado: a árvore de categorias cadastrada
  // Quando: alguém abre qualquer página do site
  // Então: o cabeçalho mostra as categorias de primeiro nível, na ordem da árvore, com link para /c/{slug}
  it('AC-025: o menu mostra cada departamento com link, na ordem recebida @spec:AC-025', () => {
    const html = renderToStaticMarkup(
      <CategoryMenu
        departments={[
          { name: 'Feminino', href: '/c/feminino' },
          { name: 'Masculino', href: '/c/masculino' },
          { name: 'Acessórios', href: '/c/acessorios' },
        ]}
      />,
    );

    expect(html).toContain('aria-label="Departamentos"');
    const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(([, href, name]) => [name, href]);
    expect(links).toEqual([
      ['Feminino', '/c/feminino'],
      ['Masculino', '/c/masculino'],
      ['Acessórios', '/c/acessorios'],
    ]);
  });

  // E: se a API não responder, o site abre normalmente, só sem o menu
  it('AC-025: sem departamentos, o menu não aparece @spec:AC-025', () => {
    expect(renderToStaticMarkup(<CategoryMenu departments={[]} />)).toBe('');
  });
});
