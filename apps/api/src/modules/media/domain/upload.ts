// Arquivos enviados pelo navegador direto ao Storage (spec 03 H2): regras puras, sem Nest
// nem rede (ADR-0002).

/** Tipos aceitos e a extensão do arquivo no Storage. */
export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type ImageType = keyof typeof IMAGE_TYPES;

export const IMAGE_TYPE_LIST = Object.keys(IMAGE_TYPES) as ImageType[];

/** 5 MB, o mesmo limite configurado no bucket. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isImageType(contentType: string): contentType is ImageType {
  return Object.hasOwn(IMAGE_TYPES, contentType);
}

/** Pasta da loja no bucket: cada loja só usa o que está dentro dela. */
export function sellerFolder(sellerId: string): string {
  return `sellers/${sellerId}/`;
}

/** `sellers/{sellerId}/{id}.{ext}`: o nome é aleatório, nunca o do arquivo do vendedor. */
export function uploadPath(sellerId: string, contentType: ImageType, id: string): string {
  return `${sellerFolder(sellerId)}${id}.${IMAGE_TYPES[contentType]}`;
}

/** O caminho é um arquivo direto da pasta da loja (sem subir de pasta com `..`). */
export function isInSellerFolder(path: string, sellerId: string): boolean {
  const folder = sellerFolder(sellerId);
  return path.startsWith(folder) && /^[\w-]+\.\w+$/.test(path.slice(folder.length));
}

/** O que o Storage diz do arquivo que chegou de verdade. */
export interface StoredFile {
  contentType: string;
  sizeBytes: number;
}

export type StoredFileProblem = 'type' | 'size';

/**
 * Confere o arquivo real: o navegador declarou o tipo e o tamanho ao pedir a URL, mas
 * quem vale é o que está no Storage.
 */
export function storedFileProblem(file: StoredFile): StoredFileProblem | null {
  if (!isImageType(file.contentType)) return 'type';
  if (file.sizeBytes <= 0 || file.sizeBytes > MAX_UPLOAD_BYTES) return 'size';
  return null;
}
