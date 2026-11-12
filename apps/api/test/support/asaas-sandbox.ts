import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import type { SubaccountInput } from '../../src/modules/payments/application/payment-gateway.port.js';
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
 * A loja de teste é sempre a mesma (ASM-013): o sandbox aceita só 20 subcontas por dia.
 * Dados fictícios; o CPF é um número válido de exemplo, de ninguém.
 */
export const LOJA_TESTE: SubaccountInput = {
  name: 'Loja Teste Vitrine',
  email: 'loja-teste-spike@vitrine.dev.br',
  cpfCnpj: '52998224725',
  birthDate: '1990-05-10',
  mobilePhone: '11987654321',
  monthlyIncomeCents: 500_000,
  address: {
    street: 'Avenida Paulista',
    number: '1000',
    province: 'Bela Vista',
    postalCode: '01310100',
  },
};
