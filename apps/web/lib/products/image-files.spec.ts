import { describe, expect, it } from 'vitest';

import {
  checkSelectedFile,
  fitSelection,
  MAX_INPUT_BYTES,
  MAX_UPLOAD_BYTES,
  moveItem,
  type PhotoDeps,
  pickUpload,
  removeItem,
  targetSize,
  uploadPhoto,
} from './image-files';

const MB = 1024 * 1024;

/** Um arquivo "escolhido" com o tipo e o tamanho que o teste quiser, sem ler bytes de verdade. */
function arquivo(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function blob(type: string, size: number): Blob {
  const b = new Blob(['x'], { type });
  Object.defineProperty(b, 'size', { value: size });
  return b;
}

/** Envio de mentira: anota cada passo e responde como mandado. */
function envio({ reduzida = blob('image/webp', 300_000), ticket = true, storage = 200 } = {}) {
  const passos: string[] = [];
  const deps: PhotoDeps = {
    shrink: async (file) => {
      passos.push(`reduz ${file.name}`);
      return reduzida;
    },
    requestUpload: async (contentType, sizeBytes) => {
      passos.push(`pede URL ${contentType} ${sizeBytes}`);
      return ticket ? { ok: true, path: 'sellers/s/a.webp', uploadUrl: 'https://storage.test/upload/a' } : { ok: false, message: 'Envie uma imagem JPEG, PNG ou WebP.' };
    },
    put: async (url, body) => {
      passos.push(`PUT ${url} ${body.type}`);
      return { ok: storage < 300, status: storage };
    },
  };
  return { deps, passos };
}

describe('US-031 — Envio das fotos no navegador', () => {
  // Dado: a etapa de imagens
  // Quando: o vendedor escolhe arquivos
  // Então: outro tipo é recusado antes de qualquer envio; a foto é reduzida (até 1600 px, WebP);
  //        acima de 5 MB depois de reduzir é recusada; as válidas sobem direto pela URL assinada
  // E: o limite de 8 fotos vale na tela
  it('AC-085: tipo errado é recusado antes de reduzir, pedir URL ou enviar @spec:AC-085', async () => {
    const { deps, passos } = envio();

    const gif = await uploadPhoto(arquivo('animacao.gif', 'image/gif', 200_000), deps);
    const enorme = await uploadPhoto(arquivo('raw.jpg', 'image/jpeg', MAX_INPUT_BYTES + 1), deps);

    expect(gif).toEqual({ ok: false, message: 'animacao.gif: envie uma foto JPEG, PNG ou WebP.' });
    expect(enorme).toEqual({ ok: false, message: 'raw.jpg: a foto passa de 20 MB.' });
    expect(passos).toEqual([]);
  });

  it('AC-085: a foto válida é reduzida e sobe direto ao Storage pela URL assinada @spec:AC-085', async () => {
    const { deps, passos } = envio();

    // 12 MB de câmera: grande demais para enviar, mas aceita para reduzir.
    const foto = await uploadPhoto(arquivo('vestido.jpg', 'image/jpeg', 12 * MB), deps);

    expect(foto).toMatchObject({ ok: true, path: 'sellers/s/a.webp' });
    expect(passos).toEqual(['reduz vestido.jpg', 'pede URL image/webp 300000', 'PUT https://storage.test/upload/a image/webp']);
  });

  it('AC-085: acima de 5 MB depois de reduzir, a recusa vem antes de pedir a URL @spec:AC-085', async () => {
    const grande = envio({ reduzida: blob('image/webp', MAX_UPLOAD_BYTES + 1) });
    expect(await uploadPhoto(arquivo('panorama.png', 'image/png', 15 * MB), grande.deps)).toEqual({
      ok: false,
      message: 'panorama.png: mesmo reduzida, a foto passa de 5 MB.',
    });
    expect(grande.passos).toEqual(['reduz panorama.png']);

    const semUrl = envio({ ticket: false });
    expect(await uploadPhoto(arquivo('a.jpg', 'image/jpeg', MB), semUrl.deps)).toMatchObject({ ok: false });
    expect(semUrl.passos.some((passo) => passo.startsWith('PUT'))).toBe(false);

    const storageFora = envio({ storage: 403 });
    expect(await uploadPhoto(arquivo('a.jpg', 'image/jpeg', MB), storageFora.deps)).toEqual({
      ok: false,
      message: 'a.jpg: o envio ao Storage falhou (403). Tente de novo.',
    });
  });

  it('AC-085: o lado maior fica em até 1600 px, e a foto pequena não é aumentada @spec:AC-085', () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(targetSize(1080, 1920)).toEqual({ width: 900, height: 1600 });
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });

    // Já pequena e menor que a versão reduzida: vai a original. Grande: vai a reduzida.
    const pequena = { type: 'image/png', size: 40_000, width: 800, height: 600 };
    const reduzida = { type: 'image/webp', size: 60_000 };
    expect(pickUpload(pequena, reduzida)).toBe(pequena);
    expect(pickUpload({ ...pequena, width: 3000 }, reduzida)).toBe(reduzida);
    expect(pickUpload({ ...pequena, size: 90_000 }, reduzida)).toBe(reduzida);
  });

  it('AC-085: o limite de 8 fotos; reordenar e remover @spec:AC-085', () => {
    expect(fitSelection(['a', 'b', 'c'], 6)).toEqual({ accepted: ['a', 'b'], warning: 'O limite é de 8 fotos: 1 ficou de fora.' });
    expect(fitSelection(['a', 'b', 'c'], 8)).toEqual({ accepted: [], warning: 'O limite é de 8 fotos: 3 ficaram de fora.' });
    expect(fitSelection(['a'], 0)).toEqual({ accepted: ['a'], warning: null });

    expect(moveItem(['capa', 'b', 'c'], 2, 0)).toEqual(['c', 'capa', 'b']);
    expect(moveItem(['a', 'b'], 1, 5)).toEqual(['a', 'b']);
    expect(removeItem(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(checkSelectedFile({ name: 'x.webp', type: 'image/webp', size: MB })).toBeNull();
  });
});
