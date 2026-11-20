'use server';

import { redirect } from 'next/navigation';

import {
  publishProduct,
  requestUpload,
  saveImages,
  saveInfo,
  saveVariants,
  type StepResult,
  type StepState,
  type UploadTicketResult,
} from '@/lib/api/products';
import { serverApi } from '@/lib/api/server-fetch';

// Server Actions do formulário de produto (AC-083): cada etapa grava na API com o token da
// sessão e a versão do produto (If-Match). Com sucesso, vai para a próxima etapa; com erro,
// devolve o estado, e o que foi digitado continua na tela.

async function finish(result: Promise<StepResult>): Promise<StepState> {
  const done = await result;
  if (done.ok) redirect(done.redirectTo);
  return done.state;
}

export async function saveInfoAction(previous: StepState, formData: FormData): Promise<StepState> {
  return finish(saveInfo(await serverApi(), formData, previous));
}

export async function saveVariantsAction(previous: StepState, formData: FormData): Promise<StepState> {
  return finish(saveVariants(await serverApi(), formData, previous));
}

export async function saveImagesAction(previous: StepState, formData: FormData): Promise<StepState> {
  return finish(saveImages(await serverApi(), formData, previous));
}

export async function publishAction(previous: StepState, formData: FormData): Promise<StepState> {
  return finish(publishProduct(await serverApi(), formData, previous));
}

/** A URL assinada: o navegador envia a foto direto ao Storage, sem passar pelo site. */
export async function requestUploadAction(contentType: string, sizeBytes: number): Promise<UploadTicketResult> {
  return requestUpload(await serverApi(), { contentType, sizeBytes });
}
