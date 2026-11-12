import { describe, expect, it } from 'vitest';

import { PaymentGatewayNotConfiguredError } from '../src/modules/payments/domain/payment-errors.js';
import { AsaasHttpClient } from '../src/modules/payments/infra/asaas/asaas-http.client.js';
import { AsaasGateway } from '../src/modules/payments/infra/asaas/asaas.gateway.js';
import { LOJA_TESTE, sandboxGateway } from './support/asaas-sandbox.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('US-015 — Adaptador do Asaas no sandbox: subconta', () => {
  // Dado: os dados completos de uma loja de teste
  // Quando: o adaptador cria a subconta no sandbox, e depois tenta criar de novo com os mesmos dados
  // Então: a primeira chamada devolve o id da subconta e o walletId
  // E: a segunda não cria outra subconta: devolve a mesma (procura pelo e-mail antes de criar)
  it('AC-034: a subconta da loja é criada uma vez e reaproveitada na repetição @spec:AC-034', async () => {
    const { gateway, cassette } = sandboxGateway('subconta');

    const primeira = await gateway.createSubaccount(LOJA_TESTE);
    const segunda = await gateway.createSubaccount(LOJA_TESTE);
    cassette.done();

    expect(primeira.id).toEqual(expect.any(String));
    expect(primeira.walletId).toMatch(UUID);
    expect(segunda).toEqual(primeira);

    // Cada chamada procura pelo e-mail antes; no máximo a primeira chega a criar.
    const posts = cassette.calls.filter((c) => c.method === 'POST' && c.path === '/accounts');
    expect(posts.length).toBeLessThanOrEqual(1);
    expect(cassette.calls.at(-1)).toMatchObject({ method: 'GET', path: expect.stringContaining('/accounts?email=') });
    // A chave de API da subconta nunca é guardada (ADR-0011).
    expect(JSON.stringify(cassette.calls)).not.toMatch(/\$aact_/);
  });

  it('sem chave configurada, o adaptador falha com uma mensagem clara, sem chamar a rede', async () => {
    let chamou = false;
    const gateway = new AsaasGateway(
      new AsaasHttpClient({
        apiKey: undefined,
        baseUrl: 'https://api-sandbox.asaas.com/v3',
        fetch: async () => {
          chamou = true;
          return new Response('{}');
        },
      }),
    );

    await expect(gateway.createSubaccount(LOJA_TESTE)).rejects.toBeInstanceOf(PaymentGatewayNotConfiguredError);
    await expect(gateway.createSubaccount(LOJA_TESTE)).rejects.toThrow(/ASAAS_API_KEY/);
    expect(chamou).toBe(false);
  });

  it('recusa do Asaas vira erro com a mensagem dele, nos dois formatos que ele usa', async () => {
    const responder = (status: number, body: unknown) =>
      new AsaasGateway(
        new AsaasHttpClient({
          apiKey: 'chave-de-teste',
          baseUrl: 'https://api-sandbox.asaas.com/v3',
          fetch: async () => new Response(JSON.stringify(body), { status }),
        }),
      );
    // Formato real devolvido pelo sandbox para conta PF (gravado em 12/11/2026).
    const contaPf = responder(403, { message: 'Contas de pessoa física (CPF) não podem criar subcontas no Asaas.' });
    const campoInvalido = responder(400, { errors: [{ code: 'invalid_postalCode', description: 'O CEP informado é inválido.' }] });

    await expect(contaPf.createSubaccount(LOJA_TESTE)).rejects.toMatchObject({
      code: 'PAYMENT_PROVIDER_ERROR',
      providerStatus: 403,
      providerMessages: ['Contas de pessoa física (CPF) não podem criar subcontas no Asaas.'],
    });
    await expect(campoInvalido.createSubaccount(LOJA_TESTE)).rejects.toThrow(/O CEP informado é inválido/);
  });
});
