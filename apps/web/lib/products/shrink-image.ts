import { pickUpload, targetSize } from './image-files';

// Redução da foto no navegador (Q-013): lado maior em até 1600 px, em WebP (qualidade
// 0,85). Navegador que não gera WebP devolve outro tipo no toBlob; aí vai JPEG. Só roda no
// navegador (canvas); as regras de tamanho e escolha são puras e testadas em image-files.

const QUALITY = 0.85;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** O arquivo a enviar: a versão reduzida, ou a original se ela já for pequena e menor. */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const size = targetSize(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  let reduced = await toBlob(canvas, 'image/webp');
  if (!reduced || reduced.type !== 'image/webp') reduced = await toBlob(canvas, 'image/jpeg');
  if (!reduced) return file;

  const choice = pickUpload(
    { type: file.type, size: file.size, width, height, blob: file as Blob },
    { type: reduced.type, size: reduced.size, blob: reduced },
  );
  return choice.blob;
}
