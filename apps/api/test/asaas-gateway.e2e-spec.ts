import { describe, expect, it } from 'vitest';

import {
  PaymentGatewayNotConfiguredError,
  PixKeyNotFoundError,
  PixKeyOwnerMismatchError,
} from '../src/modules/payments/domain/payment-errors.js';
import { assertPixKeyOwner } from '../src/modules/payments/domain/pix-key.js';
import { AsaasHttpClient } from '../src/modules/payments/infra/asaas/asaas-http.client.js';
import { AsaasGateway } from '../src/modules/payments/infra/asaas/asaas.gateway.js';
import { CHAVE_PIX_TESTE, CPF_DO_TITULAR_TESTE, sandboxGateway } from './support/asaas-sandbox.js';

describe('US-015 — Adaptador do Asaas no sandbox: chave Pix da loja', () => {
  // Dado: a chave Pix de teste do sandbox (celular 47996515839) e o CPF da loja
  // Quando: o adaptador consulta o titular da chave no Asaas
  // Então: recebe o nome do titular e o documento mascarado, e a conferência aceita quando os dígitos visíveis batem
  // E: recusa quando os dígitos não batem (PIX_KEY_OWNER_MISMATCH) e quando a chave não existe (PIX_KEY_NOT_FOUND)
  it('AC-034: o titular da chave Pix é consultado e conferido com o CPF da loja @spec:AC-034', async () => {
    const { gateway, cassette } = sandboxGateway('chave-pix');

    const titular = await gateway.lookupPixKey(CHAVE_PIX_TESTE);
    const inexistente = gateway.lookupPixKey({ type: 'EMAIL', key: 'ninguem-spike@vitrine.dev.br' });
    await expect(inexistente).rejects.toBeInstanceOf(PixKeyNotFoundError);
    cassette.done();

    expect(titular).toEqual({ name: expect.any(String), maskedDocument: '***.202.745-**' });
    expect(() => assertPixKeyOwner(titular, CPF_DO_TITULAR_TESTE)).not.toThrow();
    expect(() => assertPixKeyOwner(titular, '52998224725')).toThrow(PixKeyOwnerMismatchError);
    await expect(inexistente).rejects.toMatchObject({ code: 'PIX_KEY_NOT_FOUND' });
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

    await expect(gateway.lookupPixKey(CHAVE_PIX_TESTE)).rejects.toBeInstanceOf(PaymentGatewayNotConfiguredError);
    await expect(gateway.lookupPixKey(CHAVE_PIX_TESTE)).rejects.toThrow(/ASAAS_API_KEY/);
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
    // Formato real devolvido pelo sandbox ao tentar criar subconta com conta PF (12/11/2026).
    const formatoMessage = responder(403, { message: 'Contas de pessoa física (CPF) não podem criar subcontas no Asaas.' });
    const formatoErrors = responder(400, { errors: [{ code: 'invalid_action', description: 'Chave Pix inválida.' }] });

    await expect(formatoMessage.lookupPixKey(CHAVE_PIX_TESTE)).rejects.toMatchObject({
      code: 'PAYMENT_PROVIDER_ERROR',
      providerStatus: 403,
      providerMessages: ['Contas de pessoa física (CPF) não podem criar subcontas no Asaas.'],
    });
    await expect(formatoErrors.lookupPixKey(CHAVE_PIX_TESTE)).rejects.toThrow(/Chave Pix inválida/);
  });
});
