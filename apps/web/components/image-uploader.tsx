'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { EMPTY_STEP_STATE, type ImageChoice, type StepState, type UploadTicketResult } from '@/lib/api/products';
import { ACCEPTED_TYPES, fitSelection, MAX_IMAGES, moveItem, removeItem, uploadPhoto } from '@/lib/products/image-files';
import { shrinkImage } from '@/lib/products/shrink-image';

import { errorProps, FieldError, HiddenRef, inputClass, type StepAction, StepAlerts } from './product-form-parts';

export interface UploaderImage extends ImageChoice {
  /** URL pública (foto já salva) ou a prévia local (foto recém-enviada). */
  url: string | null;
}

export type RequestUpload = (contentType: string, sizeBytes: number) => Promise<UploadTicketResult>;

// Etapa de imagens (AC-085). Cada foto é conferida no navegador (tipo e tamanho), reduzida
// (até 1600 px, WebP) e enviada direto ao Storage pela URL assinada, sem passar pelo site.
// Depois, a ordem (a primeira é a capa), o texto alternativo e a cor vão para a API.
export function ImageUploader({
  productId,
  version,
  initialImages,
  colors,
  action,
  requestUpload,
  shrink = shrinkImage,
  initialState = EMPTY_STEP_STATE,
}: {
  productId: string;
  version: number;
  initialImages: UploaderImage[];
  /** Cores das variantes ativas: cada foto pode ser de uma delas, ou de todas. */
  colors: string[];
  action: StepAction;
  requestUpload: RequestUpload;
  shrink?: (file: File) => Promise<Blob>;
  initialState?: StepState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [images, setImages] = useState<UploaderImage[]>(initialImages);
  const [notices, setNotices] = useState<string[]>([]);
  const [sending, setSending] = useState(0);
  const full = images.length >= MAX_IMAGES;

  async function sendOne(file: File): Promise<UploaderImage | string> {
    const result = await uploadPhoto(file, {
      shrink,
      requestUpload,
      // O PUT vai direto do navegador ao Storage, com o tipo do arquivo reduzido.
      put: (url, blob) => fetch(url, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob }),
    });
    if (!result.ok) return result.message;
    return { path: result.path, url: URL.createObjectURL(result.blob), alt: '', color: null };
  }

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const { accepted, warning } = fitSelection([...list], images.length);
    const messages = warning ? [warning] : [];
    setSending(accepted.length);
    // Uma por vez, na ordem escolhida: a ordem da tela é a ordem da seleção.
    for (const file of accepted) {
      const result = await sendOne(file).catch(() => `${file.name}: não foi possível preparar a foto.`);
      if (typeof result === 'string') messages.push(result);
      else setImages((current) => [...current, result]);
      setSending((count) => count - 1);
    }
    setNotices(messages);
  }

  const update = (index: number, change: Partial<UploaderImage>) =>
    setImages((current) => current.map((image, i) => (i === index ? { ...image, ...change } : image)));

  const payload: ImageChoice[] = images.map(({ path, alt, color }) => ({ path, alt, color }));

  return (
    <form action={formAction} noValidate className="space-y-6">
      <HiddenRef productId={productId} version={version} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <StepAlerts state={state} productId={productId} step="imagens" />

      <div className="space-y-2">
        <p data-count={images.length} className="text-sm">
          {images.length} de {MAX_IMAGES} fotos. A primeira é a capa.
        </p>
        <label className="block space-y-1 text-sm">
          <span className="block font-medium">Adicionar fotos</span>
          <input
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            disabled={full || sending > 0}
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <span className="block text-xs text-muted-foreground">
            JPEG, PNG ou WebP. As fotos são reduzidas para até 1600 px antes do envio.
          </span>
        </label>
        {sending > 0 ? <p role="status">Enviando {sending} foto(s)...</p> : null}
        {notices.length > 0 ? (
          <ul role="alert" aria-label="Fotos recusadas" className="space-y-1 text-sm text-red-700 dark:text-red-400">
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <ol aria-label="Fotos do produto" className="space-y-3">
        {images.map((image, index) => (
          <li key={image.path} data-image={image.path} className="flex flex-wrap items-start gap-3 rounded-md border border-border p-3">
            {image.url ? (
              <img src={image.url} alt={image.alt} width={80} height={80} className="size-20 rounded object-cover" />
            ) : null}
            <div className="min-w-48 flex-1 space-y-2">
              {index === 0 ? <span className="text-xs font-medium uppercase">Capa</span> : null}
              <input
                type="text"
                aria-label={`Texto alternativo da foto ${index + 1}`}
                placeholder="Descreva a foto (para leitores de tela)"
                maxLength={200}
                className={inputClass}
                value={image.alt}
                onChange={(event) => update(index, { alt: event.target.value })}
                {...errorProps(state, `images.${index}`)}
              />
              <select
                aria-label={`Cor da foto ${index + 1}`}
                className={inputClass}
                value={image.color ?? ''}
                onChange={(event) => update(index, { color: event.target.value || null })}
              >
                <option value="">Todas as cores</option>
                {colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <FieldError state={state} field={`images.${index}`} />
            </div>
            <div className="flex gap-1">
              <Button type="button" variant="outline" disabled={index === 0} onClick={() => setImages(moveItem(images, index, index - 1))}>
                Subir
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={index === images.length - 1}
                onClick={() => setImages(moveItem(images, index, index + 1))}
              >
                Descer
              </Button>
              <Button type="button" variant="outline" onClick={() => setImages(removeItem(images, index))}>
                Remover
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <Button type="submit" disabled={pending || sending > 0}>
        {pending ? 'Gravando...' : 'Salvar e continuar'}
      </Button>
    </form>
  );
}
