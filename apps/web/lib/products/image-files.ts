// Regras das fotos no navegador (AC-085, Q-013): puras, sem DOM. A redução em si (canvas)
// fica em shrink-image.ts; aqui ficam o que é aceito, o tamanho final e a lista.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

/** Limite da API e do bucket, para o arquivo que vai ser enviado (já reduzido). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** O arquivo escolhido pode ser maior: ele é reduzido antes do envio. */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGES = 8;
/** Lado maior da foto reduzida, em pixels. */
export const MAX_SIDE = 1600;

const MB = 1024 * 1024;

export function isAcceptedType(type: string): type is AcceptedType {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

/** Antes de reduzir: o tipo e o tamanho do arquivo escolhido. Nulo = pode seguir. */
export function checkSelectedFile(file: { name: string; type: string; size: number }): string | null {
  if (!isAcceptedType(file.type)) return `${file.name}: envie uma foto JPEG, PNG ou WebP.`;
  if (file.size > MAX_INPUT_BYTES) return `${file.name}: a foto passa de ${MAX_INPUT_BYTES / MB} MB.`;
  return null;
}

/** Depois de reduzir: o arquivo que vai ser enviado. Nulo = pode enviar. */
export function checkUploadFile(file: { name: string; type: string; size: number }): string | null {
  if (!isAcceptedType(file.type)) return `${file.name}: o navegador não conseguiu converter a foto.`;
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name}: mesmo reduzida, a foto passa de 5 MB.`;
  return null;
}

/** Dimensões da foto reduzida: o lado maior fica em até 1600 px, sem aumentar a pequena. */
export function targetSize(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Qual arquivo enviar: o reduzido, a não ser que a foto original já seja pequena
 * (até 1600 px), de um tipo aceito, e menor que a versão reduzida.
 */
export function pickUpload<T extends { type: string; size: number }>(
  original: T & { width: number; height: number },
  reduced: T,
): T {
  const alreadySmall = Math.max(original.width, original.height) <= MAX_SIDE;
  return alreadySmall && isAcceptedType(original.type) && original.size <= reduced.size ? original : reduced;
}

/** Quantos arquivos da seleção cabem, e o aviso se algum ficou de fora. */
export function fitSelection<T>(selected: readonly T[], current: number): { accepted: T[]; warning: string | null } {
  const room = Math.max(0, MAX_IMAGES - current);
  const accepted = selected.slice(0, room);
  const left = selected.length - accepted.length;
  return {
    accepted,
    warning: left > 0 ? `O limite é de ${MAX_IMAGES} fotos: ${left === 1 ? '1 ficou' : `${left} ficaram`} de fora.` : null,
  };
}

/** Move a foto de `from` para `to` (a de posição 0 é a capa). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function removeItem<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

/** O que o envio de uma foto precisa: reduzir, pedir a URL à API e enviar ao Storage. */
export interface PhotoDeps {
  shrink: (file: File) => Promise<Blob>;
  requestUpload: (contentType: string, sizeBytes: number) => Promise<{ ok: true; path: string; uploadUrl: string } | { ok: false; message: string }>;
  put: (uploadUrl: string, blob: Blob) => Promise<{ ok: boolean; status: number }>;
}

export type PhotoResult = { ok: true; path: string; blob: Blob } | { ok: false; message: string };

/**
 * Uma foto, do arquivo escolhido ao Storage (AC-085): confere o tipo e o tamanho antes de
 * tudo, reduz, confere o arquivo reduzido e só então pede a URL e envia. Recusado em
 * qualquer passo: nada vai para a API nem para o Storage depois dele.
 */
export async function uploadPhoto(file: File, deps: PhotoDeps): Promise<PhotoResult> {
  const before = checkSelectedFile(file);
  if (before) return { ok: false, message: before };
  const blob = await deps.shrink(file);
  const after = checkUploadFile({ name: file.name, type: blob.type, size: blob.size });
  if (after) return { ok: false, message: after };
  const ticket = await deps.requestUpload(blob.type, blob.size);
  if (!ticket.ok) return { ok: false, message: `${file.name}: ${ticket.message}` };
  const sent = await deps.put(ticket.uploadUrl, blob);
  if (!sent.ok) return { ok: false, message: `${file.name}: o envio ao Storage falhou (${sent.status}). Tente de novo.` };
  return { ok: true, path: ticket.path, blob };
}
