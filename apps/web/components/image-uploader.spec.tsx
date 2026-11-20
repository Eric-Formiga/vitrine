import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EMPTY_STEP_STATE, type StepState } from '../lib/api/products';
import { ImageUploader, type UploaderImage } from './image-uploader';

const parada = async (state: StepState) => state;
const semUpload = async () => ({ ok: false as const, message: 'x' });

const foto = (n: number, extra: Partial<UploaderImage> = {}): UploaderImage => ({
  path: `sellers/s/${n}.webp`,
  url: `https://x.supabase.co/${n}.webp`,
  alt: '',
  color: null,
  ...extra,
});

const render = (images: UploaderImage[], state: StepState = EMPTY_STEP_STATE) =>
  renderToStaticMarkup(
    <ImageUploader
      productId="p1"
      version={3}
      initialImages={images}
      colors={['Preto', 'Azul']}
      action={parada}
      requestUpload={semUpload}
      initialState={state}
    />,
  );

const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('US-031 — Etapa de imagens', () => {
  // Dado: a etapa de imagens
  // Quando: o vendedor escolhe arquivos
  // E: ele reordena (a primeira é a capa), escolhe a cor de cada uma e remove; o limite de 8 aparece na tela
  it('AC-085: as fotos na ordem, a primeira como capa, com cor, reordenar e remover @spec:AC-085', () => {
    const html = render([foto(1, { alt: 'Frente' }), foto(2, { color: 'Azul' })]);

    expect(html).toContain('2 de 8 fotos. A primeira é a capa.');
    expect([...html.matchAll(/<li data-image="([^"]+)"/g)].map(([, path]) => path)).toEqual(['sellers/s/1.webp', 'sellers/s/2.webp']);
    expect(html.match(/>Capa</g)).toHaveLength(1);
    expect(html).toMatch(/<select aria-label="Cor da foto 2"[^>]*>.*<option value="Azul" selected="">Azul<\/option>/);
    expect(html).toMatch(/<option value="">Todas as cores<\/option>/);
    expect(html.match(/>Remover</g)).toHaveLength(2);
    // A primeira não sobe, a última não desce.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Subir<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Descer<\/button>/);
    // Tipos aceitos no seletor de arquivos; a lista vai para a API sem a prévia.
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    const payload = JSON.parse(decode(html.match(/name="payload" value="([^"]*)"/)?.[1] ?? '[]'));
    expect(payload).toEqual([
      { path: 'sellers/s/1.webp', alt: 'Frente', color: null },
      { path: 'sellers/s/2.webp', alt: '', color: 'Azul' },
    ]);
  });

  it('AC-085: com 8 fotos, o seletor fica desligado @spec:AC-085', () => {
    const cheia = render(Array.from({ length: 8 }, (_, i) => foto(i)));
    expect(cheia).toContain('8 de 8 fotos.');
    expect(cheia).toMatch(/<input type="file"[^>]*disabled=""/);
    expect(render([foto(1)])).not.toMatch(/<input type="file"[^>]*disabled=""/);
  });

  it('AC-083: o problema de uma foto aparece junto a ela @spec:AC-083', () => {
    const html = render([foto(1), foto(2)], { ...EMPTY_STEP_STATE, fieldErrors: { 'images.1': 'Imagem 2: O arquivo não chegou ao Storage. Envie de novo.' } });
    expect(html).toMatch(/aria-label="Texto alternativo da foto 2"[^>]*aria-invalid="true"/);
    expect(html).toContain('id="field-images-1-error"');
    expect(html).toContain('Imagem 2: O arquivo não chegou ao Storage. Envie de novo.');
  });
});
