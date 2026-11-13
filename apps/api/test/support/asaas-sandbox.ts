import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import { RefundNotAllowedError } from '../../src/modules/payments/domain/payment-errors.js';
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
    // O vencimento é "hoje" na hora em que o teste roda.
    volatileRequestFields: ['dueDate'],
  });
  const client = new AsaasHttpClient({
    apiKey: RECORDING ? sandboxApiKey() : 'chave-falsa-so-para-reproduzir',
    baseUrl: SANDBOX_URL,
    fetch: cassette.fetch,
  });
  return { gateway: new AsaasGateway(client), client, cassette };
}

/**
 * Simula, no sandbox, o comprador pagando a cobrança (POST /sandbox/payment/{id}/confirm).
 * Só existe no sandbox, por isso mora aqui e nunca na porta de pagamento.
 */
export async function confirmPaymentInSandbox(client: AsaasHttpClient, paymentId: string): Promise<void> {
  await client.post(`/sandbox/payment/${encodeURIComponent(paymentId)}/confirm`);
}

/**
 * O sandbox recusa estorno logo depois do recebimento ("Tente novamente em alguns
 * instantes"; ~4 s na sondagem de 13/11/2026). Tenta de novo, esperando só na gravação:
 * na reprodução, as recusas gravadas voltam na hora.
 */
export async function whenRefundable<T>(attempt: () => Promise<T>): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      const early = error instanceof RefundNotAllowedError && /tente novamente/i.test(error.message);
      if (!early || tries >= 20) throw error;
      if (RECORDING) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
}

/**
 * Chave Pix de teste do Banco Central: destino das transferências no sandbox. O Asaas
 * recusa, no mesmo dia, outra transferência de mesmo valor para a mesma chave (409); para
 * regravar no mesmo dia de outra gravação, troque o número (cliente-a00001, a00002...).
 */
export const CHAVE_PIX_BCB: PixKey = { type: 'EMAIL', key: 'cliente-a00003@pix.bcb.gov.br' };

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo, como o Asaas espera no vencimento. */
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

/** Comprador de teste. O CPF é um número válido de exemplo, de ninguém. */
export const COMPRADOR_TESTE = {
  name: 'Comprador de Teste da Vitrine',
  document: '11144477735',
  email: 'comprador-spike@vitrine.dev.br',
};

/** Dados do titular do cartão, como o Asaas exige na cobrança direta. */
export const TITULAR_CARTAO_TESTE = {
  ...COMPRADOR_TESTE,
  postalCode: '01310100',
  addressNumber: '1000',
  phone: '11999999999',
};

/**
 * Cartões do sandbox. Em 13/11/2026 o sandbox aprovou até os "cartões de recusa" da
 * documentação (Mastercard 5184019740373151, Visa 4916561358240741) e números inválidos;
 * a única recusa reproduzível é o cartão vencido (400 invalid_creditCard).
 */
export const CARTAO_APROVADO = {
  holderName: 'COMPRADOR TESTE',
  number: '5162306219378829',
  expiryMonth: '12',
  expiryYear: '2031',
  ccv: '123',
};
export const CARTAO_RECUSADO = { ...CARTAO_APROVADO, expiryMonth: '01', expiryYear: '2020' };

/**
 * Única chave Pix que o sandbox deixa consultar (documentação do Asaas). O titular vem
 * mascarado como ***.202.745-**; o CPF abaixo é um número válido de teste com esses
 * dígitos no meio, de ninguém.
 */
export const CHAVE_PIX_TESTE: PixKey = { type: 'PHONE', key: '47996515839' };
export const CPF_DO_TITULAR_TESTE = '11120274591';
