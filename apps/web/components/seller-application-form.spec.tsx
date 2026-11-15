import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ApplicationField, ApplicationFormState } from '../lib/api/seller';
import { SellerApplicationForm } from './seller-application-form';

const naoEnvia = async (state: ApplicationFormState) => state;

const CATEGORIAS = [
  { id: 'f', label: 'Feminino' },
  { id: 'v', label: '— Vestidos' },
];

const render = (initialState?: ApplicationFormState) =>
  renderToStaticMarkup(<SellerApplicationForm action={naoEnvia} categories={CATEGORIAS} initialState={initialState} />);

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A tag do controle (input, textarea ou select) com este `name`. */
function controle(html: string, name: string): string {
  const tag = html.match(new RegExp(`<(input|textarea|select)\\b[^>]*\\bname="${escapeRe(name)}"[^>]*>`));
  expect(tag, `campo ${name}`).not.toBeNull();
  return tag![0];
}

const atributo = (tag: string, nome: string) => tag.match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1];

/** A mensagem que o leitor de tela anuncia junto ao campo (aria-describedby). */
function mensagemDoCampo(html: string, name: string): string | undefined {
  const tag = controle(html, name);
  if (atributo(tag, 'aria-invalid') !== 'true') return undefined;
  const id = atributo(tag, 'aria-describedby');
  if (!id) return undefined;
  return html.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${escapeRe(id)}"[^>]*>([^<]*)<`))?.[1];
}

/** O valor que o campo mostra ao abrir a página. */
function valorDoCampo(html: string, name: string): string | undefined {
  const tag = controle(html, name);
  if (tag.startsWith('<input')) return atributo(tag, 'value');
  if (tag.startsWith('<textarea')) {
    return html.match(new RegExp(`<textarea\\b[^>]*\\bname="${escapeRe(name)}"[^>]*>([^<]*)</textarea>`))?.[1];
  }
  const select = html.match(new RegExp(`<select\\b[^>]*\\bname="${escapeRe(name)}"[^>]*>(.*?)</select>`))?.[1];
  return select?.match(/<option[^>]*value="([^"]*)"[^>]*selected=""/)?.[1];
}

const digitado: Record<ApplicationField, string> = {
  storeName: 'Ateliê da Ana',
  slug: 'atelie-da-ana',
  bio: 'Roupas autorais feitas à mão.',
  document: '111.444.777-35',
  mainCategoryId: 'v',
  instagram: '@atelie.ana',
  'pixKey.type': 'EMAIL',
  'pixKey.key': 'ana@exemplo.com',
};

describe('US-022 — Candidatura pelo site (tela)', () => {
  // Dado: uma pessoa logada, sem loja
  // Quando: ela abre /vender, preenche o formulário e envia
  // E: com erro, a mensagem aparece junto ao campo, e o que ela digitou continua no formulário
  it('AC-058: a mensagem de erro aparece junto ao campo e o que foi digitado continua no formulário @spec:AC-058', () => {
    const html = render({
      attempt: 1,
      values: digitado,
      fieldErrors: {
        'pixKey.key': 'Esta chave Pix não está no CPF/CNPJ da loja. Use uma chave da própria loja.',
        slug: 'O endereço "atelie-da-ana" já é usado por outra loja. Escolha outro.',
      },
      formError: null,
    });

    expect(mensagemDoCampo(html, 'pixKey.key')).toBe(
      'Esta chave Pix não está no CPF/CNPJ da loja. Use uma chave da própria loja.',
    );
    expect(mensagemDoCampo(html, 'slug')).toBe(
      'O endereço &quot;atelie-da-ana&quot; já é usado por outra loja. Escolha outro.',
    );
    // Os campos sem erro não ficam marcados.
    for (const campo of ['storeName', 'bio', 'document', 'mainCategoryId', 'instagram', 'pixKey.type']) {
      expect(mensagemDoCampo(html, campo), campo).toBeUndefined();
    }
    for (const [campo, valor] of Object.entries(digitado)) {
      expect(valorDoCampo(html, campo), campo).toBe(valor);
    }
  });

  it('AC-058: erro que não é de um campo aparece como aviso no topo, sem apagar o digitado @spec:AC-058', () => {
    const html = render({
      attempt: 1,
      values: digitado,
      fieldErrors: {},
      formError: 'Sua candidatura foi recusada. Você pode se candidatar de novo a partir de 20/11/2026.',
    });

    expect(html).toMatch(/role="alert"[^>]*>Sua candidatura foi recusada\. .*a partir de 20\/11\/2026\.</);
    expect(valorDoCampo(html, 'pixKey.key')).toBe('ana@exemplo.com');
  });

  it('AC-058: o formulário em branco pede os dados da loja, a categoria e a chave Pix @spec:AC-058', () => {
    const html = render();

    for (const campo of ['storeName', 'slug', 'bio', 'document', 'mainCategoryId', 'instagram', 'pixKey.type', 'pixKey.key']) {
      expect(valorDoCampo(html, campo) ?? '', campo).toBe('');
      expect(mensagemDoCampo(html, campo), campo).toBeUndefined();
    }
    expect(html).not.toContain('role="alert"');
    const categorias = [...html.matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(([, id, nome]) => [id, nome]);
    expect(categorias).toEqual([
      ['f', 'Feminino'],
      ['v', '— Vestidos'],
      ['CPF', 'CPF'],
      ['CNPJ', 'CNPJ'],
      ['EMAIL', 'E-mail'],
      ['PHONE', 'Celular'],
      ['EVP', 'Chave aleatória'],
    ]);
  });
});
