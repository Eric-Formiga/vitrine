import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import type { PixKey } from '../../src/modules/payments/domain/pix-key.js';
import { AsaasHttpClient } from '../../src/modules/payments/infra/asaas/asaas-http.client.js';
import { AsaasGateway } from '../../src/modules/payments/infra/asaas/asaas.gateway.js';
import { type Cassette, createCassette } from './http-cassette.js';

// Kit dos testes de contrato com o Asaas (ASM-012). Com ASAAS_RECORD=1, fala com o
// sandbox de verdade e grava as respostas em test/fixtures/asaas; sem a variável,
// reproduz o que foi gravado, sem rede e sem chave.

export const RECORDING = process.env.ASAAS_RECORD === '1';
export const SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

const rootEnvFile = new URL('../../../../.env', import.meta.url);

/** Só a chave do Asaas é lida do .env; nada mais da configuração local entra nos testes. */
function sandboxApiKey(): string {
  const fromEnvFile = existsSync(rootEnvFile) ? parseEnv(readFileSync(rootEnvFile, 'utf8')).ASAAS_API_KEY : undefined;
  const apiKey = process.env.ASAAS_API_KEY ?? fromEnvFile;
  if (!apiKey) throw new Error('Para gravar (ASAAS_RECORD=1) é preciso a ASAAS_API_KEY do sandbox no .env da raiz.');
  return apiKey;
}

export interface SandboxKit {
  gateway: AsaasGateway;
  client: AsaasHttpClient;
  cassette: Cassette;
}

/** Gateway ligado ao cassete `test/fixtures/asaas/<cenario>.json`. */
export function sandboxGateway(scenario: string): SandboxKit {
  const cassette = createCassette(new URL(`../fixtures/asaas/${scenario}.json`, import.meta.url), {
    baseUrl: SANDBOX_URL,
    record: RECORDING,
  });
  const client = new AsaasHttpClient({
    apiKey: RECORDING ? sandboxApiKey() : 'chave-falsa-so-para-reproduzir',
    baseUrl: SANDBOX_URL,
    fetch: cassette.fetch,
  });
  return { gateway: new AsaasGateway(client), client, cassette };
}

/**
 * Única chave Pix que o sandbox deixa consultar (documentação do Asaas). O titular vem
 * mascarado como ***.202.745-**; o CPF abaixo é um número válido de teste com esses
 * dígitos no meio, de ninguém.
 */
export const CHAVE_PIX_TESTE: PixKey = { type: 'PHONE', key: '47996515839' };
export const CPF_DO_TITULAR_TESTE = '11120274591';
