import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { StorageNotConfiguredError } from '../src/modules/media/application/storage-gateway.port.js';
import { SupabaseStorageGateway } from '../src/modules/media/infra/supabase-storage.gateway.js';
import { BUCKET, PNG_1X1, storageSandbox } from './support/supabase-sandbox.js';

/** Data de emissão (iat) e de expiração (exp) do token da URL assinada, em segundos. */
function tokenTimes(uploadUrl: string): { iat: number; exp: number } {
  const token = new URL(uploadUrl).searchParams.get('token') ?? '';
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { iat: number; exp: number };
}

describe('US-025 — Adaptador do Supabase Storage', () => {
  // Dado: um projeto Supabase com o bucket de imagens de produto
  // Quando: o adaptador cria uma URL assinada, um arquivo é enviado por ela, o adaptador
  //         confere o arquivo (tipo e tamanho) e depois o apaga
  // Então: cada passo responde como o adaptador espera
  // E: a conversa fica gravada num cassete, para o teste rodar sem rede e sem chave
  it('AC-070: o caminho real funciona contra o Supabase Storage @spec:AC-070', async () => {
    const { gateway, cassette } = storageSandbox('upload-e-limpeza');
    // Novo a cada gravação, numa pasta de loja que não existe: nunca encosta em foto de verdade.
    const path = cassette.value('caminho', () => `sellers/00000000-0000-7000-8000-00000000c0de/${randomUUID()}.png`);

    const assinada = await gateway.createSignedUpload(path);
    // O papel do navegador: envia o arquivo direto ao Storage, sem a chave, só com a URL.
    const envio = await cassette.fetch(assinada.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: PNG_1X1,
    });
    const conferido = await gateway.stat(path);
    await gateway.remove([path]);
    const depoisDeApagar = await gateway.stat(path);
    const inexistente = await gateway.stat(`sellers/00000000-0000-7000-8000-00000000c0de/nunca-enviado.png`);
    cassette.done();

    expect(new URL(assinada.uploadUrl).pathname).toBe(`/storage/v1/object/upload/sign/${BUCKET}/${path}`);
    const { iat, exp } = tokenTimes(assinada.uploadUrl);
    // A validade vem do próprio token. No Supabase hospedado, 2 horas fixas (ASM-032).
    expect(assinada.expiresAt.getTime()).toBe(exp * 1000);
    expect(exp - iat).toBe(7200);
    expect(envio.status).toBe(200);
    expect(conferido).toEqual({ contentType: 'image/png', sizeBytes: PNG_1X1.length });
    expect(depoisDeApagar).toBeNull();
    expect(inexistente).toBeNull();
    expect(gateway.publicUrl(path)).toMatch(new RegExp(`/storage/v1/object/public/${BUCKET}/${path}$`));
  });

  it('sem URL e chave, o Storage responde 503 e a URL pública fica nula', async () => {
    const semConfig = new SupabaseStorageGateway({ url: undefined, secretKey: undefined, bucket: BUCKET });
    await expect(semConfig.createSignedUpload('sellers/x/y.png')).rejects.toBeInstanceOf(StorageNotConfiguredError);
    await expect(semConfig.stat('sellers/x/y.png')).rejects.toMatchObject({ code: 'STORAGE_NOT_CONFIGURED', status: 503 });
    expect(semConfig.publicUrl('sellers/x/y.png')).toBeNull();
  });
});
