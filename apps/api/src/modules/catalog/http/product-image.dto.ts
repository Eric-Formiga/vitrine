import { z } from 'zod';

import { ALT_MAX, IMAGES_MAX, type ProductImage } from '../domain/product-image.js';

// Formatos da lista de fotos do produto. O formato da lista (quantidade, repetição) é 400;
// o problema de um arquivo (pasta, Storage, cor) é 422 INVALID_IMAGE, no caso de uso.

const imageInputSchema = z
  .object({
    path: z.string({ error: 'Informe o caminho do arquivo.' }).min(1).describe('O `path` devolvido por POST /v1/seller/uploads.'),
    alt: z
      .string()
      .trim()
      .max(ALT_MAX, `Use no máximo ${ALT_MAX} caracteres.`)
      .default('')
      .describe('Texto alternativo, para quem usa leitor de tela.'),
    color: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .default(null)
      .describe('Cor de uma variante ativa; nula vale para todas as cores.'),
  })
  .strict()
  .meta({ id: 'ProductImageInput' });

export const productImagesSchema = z
  .object({
    images: z
      .array(imageInputSchema)
      .max(IMAGES_MAX, `Use no máximo ${IMAGES_MAX} imagens.`)
      .refine((images) => new Set(images.map((image) => image.path)).size === images.length, {
        message: 'A mesma imagem aparece mais de uma vez.',
      }),
  })
  .strict()
  .meta({
    id: 'ProductImagesInput',
    description: 'A lista inteira, na ordem: a primeira é a capa. Substitui a anterior. Exige If-Match.',
  });

export type ProductImagesBody = z.output<typeof productImagesSchema>;

export const productImageListSchema = z
  .object({
    images: z.array(
      z
        .object({
          path: z.string(),
          url: z.string().nullable().describe('URL pública; nula sem o Storage configurado.'),
          alt: z.string(),
          color: z.string().nullable(),
          position: z.int().describe('0 é a capa.'),
        })
        .meta({ id: 'ProductImage' }),
    ),
  })
  .meta({ id: 'ProductImageList' });

export type ProductImageListResponse = z.output<typeof productImageListSchema>;

export function toProductImageList(
  images: readonly ProductImage[],
  publicUrl: (path: string) => string | null,
): ProductImageListResponse {
  return { images: images.map((image) => ({ ...image, url: publicUrl(image.path) })) };
}
