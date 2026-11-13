import { describe, expect, it } from 'vitest';

import {
  PaymentDeclinedError,
  PaymentGatewayNotConfiguredError,
  PixKeyNotFoundError,
  PixKeyOwnerMismatchError,
} from '../src/modules/payments/domain/payment-errors.js';
import { assertPixKeyOwner } from '../src/modules/payments/domain/pix-key.js';
import { AsaasHttpClient } from '../src/modules/payments/infra/asaas/asaas-http.client.js';
import { AsaasGateway } from '../src/modules/payments/infra/asaas/asaas.gateway.js';
import {
  CARTAO_APROVADO,
  CARTAO_RECUSADO,
  CHAVE_PIX_TESTE,
  COMPRADOR_TESTE,
  CPF_DO_TITULAR_TESTE,
  confirmPaymentInSandbox,
  sandboxGateway,
  TITULAR_CARTAO_TESTE,
  todayInSaoPaulo,
} from './support/asaas-sandbox.js';

const DATA = expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/);

describe('US-015 — Adaptador do Asaas no sandbox: chave Pix e cobranças', () => {
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

  // Dado: um comprador de teste
  // Quando: o adaptador cria uma cobrança Pix de R$ 50,00 (sem split) e o recebimento é simulado no sandbox
  // Então: lê a cobrança como recebida (RECEIVED), com o valor líquido e a data do recebimento
  // E: o saldo disponível da plataforma aumenta
  it('AC-035: Pix cobrado na conta da plataforma e recebido aumenta o saldo @spec:AC-035', async () => {
    const { gateway, client, cassette } = sandboxGateway('pix-recebido');

    const saldoAntes = await gateway.getAvailableBalanceCents();
    const customerId = await gateway.ensureCustomer(COMPRADOR_TESTE);
    const cobranca = await gateway.createPixPayment({
      customerId,
      amountCents: 5000,
      dueDate: todayInSaoPaulo(),
      description: 'Spike Asaas: cobrança Pix',
      reference: 'spike:pix-recebido',
    });
    await confirmPaymentInSandbox(client, cobranca.id);
    const recebida = await gateway.getPayment(cobranca.id);
    const saldoDepois = await gateway.getAvailableBalanceCents();
    cassette.done();

    expect(cobranca).toMatchObject({ method: 'PIX', status: 'PENDING', amountCents: 5000, reference: 'spike:pix-recebido' });
    expect(recebida).toMatchObject({ id: cobranca.id, status: 'RECEIVED', amountCents: 5000, receivedOn: DATA });
    expect(recebida.netAmountCents).toBeGreaterThan(0);
    expect(recebida.netAmountCents).toBeLessThanOrEqual(5000);
    expect(saldoDepois - saldoAntes).toBe(recebida.netAmountCents);
  });

  // Dado: um comprador de teste
  // Quando: o adaptador cobra com o cartão de teste de aprovação e, depois, com o de recusa
  // Então: a cobrança aprovada fica confirmada (CONFIRMED), mas ainda não recebida (D+32)
  // E: a recusa vira um erro de domínio (PAYMENT_DECLINED), sem estourar erro genérico
  it('AC-036: cartão aprovado fica confirmado e cartão recusado vira PAYMENT_DECLINED @spec:AC-036', async () => {
    const { gateway, cassette } = sandboxGateway('cartao');

    const customerId = await gateway.ensureCustomer(COMPRADOR_TESTE);
    const cobrar = (card: typeof CARTAO_APROVADO, reference: string) =>
      gateway.createCardPayment({
        customerId,
        amountCents: 8990,
        dueDate: todayInSaoPaulo(),
        description: 'Spike Asaas: cobrança com cartão',
        reference,
        card,
        holder: TITULAR_CARTAO_TESTE,
        remoteIp: '203.0.113.10',
      });
    const aprovada = await cobrar(CARTAO_APROVADO, 'spike:cartao-aprovado');
    const recusada = cobrar(CARTAO_RECUSADO, 'spike:cartao-recusado');
    await expect(recusada).rejects.toBeInstanceOf(PaymentDeclinedError);
    cassette.done();

    expect(aprovada).toMatchObject({
      method: 'CREDIT_CARD',
      status: 'CONFIRMED',
      amountCents: 8990,
      confirmedOn: DATA,
      receivedOn: null,
      expectedCreditOn: DATA,
    });
    expect(aprovada.expectedCreditOn! > aprovada.confirmedOn!).toBe(true);
    await expect(recusada).rejects.toMatchObject({ code: 'PAYMENT_DECLINED', status: 402 });
  });

  // Dado: um pedido de teste com valor e prazo de expiração
  // Quando: o adaptador cria o Checkout hospedado
  // Então: recebe o id e o endereço da página de pagamento do Asaas, aceitando Pix e cartão
  // E: o pedido fica ligado ao Checkout (externalReference = id do pedido)
  it('AC-037: Checkout hospedado criado com Pix e cartão e ligado ao pedido @spec:AC-037', async () => {
    const { gateway, cassette } = sandboxGateway('checkout');
    const pedidoId = 'pedido-spike-t013';

    const checkout = await gateway.createCheckout({
      reference: pedidoId,
      expiresInMinutes: 15,
      items: [
        { name: 'Camiseta básica', quantity: 2, unitAmountCents: 4990 },
        { name: 'Boné', quantity: 1, unitAmountCents: 3500 },
      ],
      successUrl: 'https://vitrine.dev.br/checkout/sucesso',
      cancelUrl: 'https://vitrine.dev.br/checkout/cancelado',
      expiredUrl: 'https://vitrine.dev.br/checkout/expirado',
    });
    cassette.done();

    expect(checkout.id).toEqual(expect.any(String));
    expect(checkout.url).toMatch(/^https:\/\/sandbox\.asaas\.com\/.+/);
    expect(checkout.url).toContain(checkout.id);
    expect(checkout.methods).toEqual(expect.arrayContaining(['PIX', 'CREDIT_CARD']));
    expect(checkout.reference).toBe(pedidoId);
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

  it('só erro de cartão vira recusa: outro 400 do Asaas continua erro do provedor', async () => {
    const gateway = new AsaasGateway(
      new AsaasHttpClient({
        apiKey: 'chave-de-teste',
        baseUrl: 'https://api-sandbox.asaas.com/v3',
        fetch: async () =>
          new Response(JSON.stringify({ errors: [{ code: 'invalid_customer', description: 'Cliente inválido.' }] }), {
            status: 400,
          }),
      }),
    );

    const cobranca = gateway.createCardPayment({
      customerId: 'cus_inexistente',
      amountCents: 1000,
      dueDate: '2026-11-13',
      description: 'teste',
      reference: 'teste',
      card: CARTAO_APROVADO,
      holder: TITULAR_CARTAO_TESTE,
      remoteIp: '203.0.113.10',
    });
    await expect(cobranca).rejects.toMatchObject({ code: 'PAYMENT_PROVIDER_ERROR', providerCodes: ['invalid_customer'] });
  });
});
