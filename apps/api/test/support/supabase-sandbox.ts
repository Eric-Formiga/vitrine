import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { SupabaseStorageGateway } from '../../src/modules/media/infra/supabase-storage.gateway.js';
import { type Cassette, createCassette } from './http-cassette.js';

// Kit do teste de contrato com o Supabase Storage (AC-070), como o do Asaas. Com
// SUPABASE_RECORD=1, fala com o projeto de verdade (URL e secret key do .env da raiz) e
// grava em test/fixtures/supabase; sem a variável, reproduz o gravado, sem rede e sem chave.

export const RECORDING = process.env.SUPABASE_RECORD === '1';
export const BUCKET = 'product-images';
/** Endereço de mentira para a reprodução: o cassete guarda só os caminhos. */
const REPLAY_URL = 'https://projeto-de-teste.supabase.co';

const rootEnvFile = new URL('../../../../.env', import.meta.url);

/** Só as duas variáveis do Supabase são lidas do .env; nada mais entra nos testes. */
function projectSettings(): { url: string; secretKey: string } {
  const fromFile = existsSync(rootEnvFile) ? parseEnv(readFileSync(rootEnvFile, 'utf8')) : {};
  const url = process.env.SUPABASE_URL ?? fromFile.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? fromFile.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error('Para gravar (SUPABASE_RECORD=1) é preciso SUPABASE_URL e SUPABASE_SECRET_KEY no .env da raiz.');
  return { url, secretKey };
}

export interface StorageKit {
  gateway: SupabaseStorageGateway;
  cassette: Cassette;
}

/** Gateway ligado ao cassete `test/fixtures/supabase/<cenario>.json`. */
export function storageSandbox(scenario: string): StorageKit {
  const { url, secretKey } = RECORDING ? projectSettings() : { url: REPLAY_URL, secretKey: 'chave-falsa-so-para-reproduzir' };
  const cassette = createCassette(new URL(`../fixtures/supabase/${scenario}.json`, import.meta.url), {
    baseUrl: url,
    record: RECORDING,
    recordVariable: 'SUPABASE_RECORD',
  });
  return { gateway: new SupabaseStorageGateway({ url, secretKey, bucket: BUCKET, fetch: cassette.fetch }), cassette };
}

/** PNG de 1×1 pixel: o menor arquivo de imagem válido para o envio de teste. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
