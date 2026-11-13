# Tasks: Spike Asaas — adaptador de pagamento provado no sandbox

> feature: spike-asaas

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-012 — Porta de pagamento, cliente do Asaas e conferência da chave Pix [concluida]
- Refs: US-015, AC-034
- Arquivos: .env.example, apps/api/src/shared/config/env.ts, apps/api/src/shared/config/env.spec.ts, apps/api/src/app.module.ts, apps/api/src/modules/payments/payments.module.ts, apps/api/src/modules/payments/application/payment-gateway.port.ts, apps/api/src/modules/payments/domain/payment-errors.ts, apps/api/src/modules/payments/domain/pix-key.ts, apps/api/src/modules/payments/domain/pix-key.spec.ts, apps/api/src/modules/payments/infra/asaas/asaas-http.client.ts, apps/api/src/modules/payments/infra/asaas/asaas.gateway.ts, apps/api/test/support/asaas-sandbox.ts, apps/api/test/support/http-cassette.ts, apps/api/test/fixtures/asaas, apps/api/test/asaas-gateway.e2e-spec.ts
- Notas: primeira tarefa. Variáveis `ASAAS_API_KEY`, `ASAAS_API_URL` (padrão: sandbox) e `ASAAS_WEBHOOK_TOKEN`, opcionais na subida (a API sobe sem pagamento configurado); o adaptador falha com mensagem clara se for usado sem chave. Porta `PaymentGateway` em `payments/application` (ADR-0002, ADR-0011), com tipos próprios da Vitrine (centavos, nunca o formato do Asaas). Cliente HTTP fino sobre `fetch`: cabeçalho `access_token`, `User-Agent` genérico, timeout, erros do Asaas (`errors[].description`) traduzidos para erros de domínio. `lookupPixKey({ type, key })` consulta o titular (`GET /v3/pix/addressKeys/external`); 404 vira `PixKeyNotFoundError`. A regra de conferência (dígitos visíveis do documento mascarado contra o CPF/CNPJ da loja) é pura, no domínio, e recusa com `PixKeyOwnerMismatchError` (ADR-0012). Erros do Asaas vêm em dois formatos (`errors[]` ou `message`, como a recusa de subconta para conta PF); os dois são lidos. O cliente recebe o `fetch` por injeção. O kit de teste usa um "cassete" (ASM-012): com `ASAAS_RECORD=1`, carrega o `.env` da raiz, chama o sandbox de verdade e grava cada requisição e resposta em `test/fixtures/asaas/<cenário>.json`, **sem** o cabeçalho `access_token` e com qualquer `apiKey` das respostas trocada por `[removida]`; sem a variável, reproduz o cassete em ordem e falha se a requisição não bater com a gravada. A chave de consulta do sandbox é a de teste da documentação (`47996515839`).

## T-013 — Cobranças: Pix recebido, cartão e Checkout hospedado [concluida]
- Refs: US-015, AC-035, AC-036, AC-037
- Arquivos: apps/api/src/modules/payments/application/payment-gateway.port.ts, apps/api/src/modules/payments/domain/payment-errors.ts, apps/api/src/modules/payments/infra/asaas/asaas-http.client.ts, apps/api/src/modules/payments/infra/asaas/asaas.gateway.ts, apps/api/test/support/asaas-sandbox.ts, apps/api/test/support/http-cassette.ts, apps/api/test/fixtures/asaas, apps/api/test/asaas-gateway.e2e-spec.ts
- Notas: depende da T-012. O cassete também remove o `creditCardToken` das respostas gravadas. Cliente do comprador (`POST /v3/customers`, procurado pelo CPF antes, com os avisos do Asaas desligados). Cobrança Pix e cobrança com cartão na conta da plataforma, sem split. Recebimento do Pix simulado pela ação de sandbox (`POST /v3/sandbox/payment/{id}/confirm`), exposta só no kit de teste, nunca na porta. `getPayment` devolve status, valor, valor líquido, datas de confirmação, recebimento e crédito previsto. A cobrança direta com cartão fica no adaptador, **fora da porta**: em produção o cartão só passa pelo Checkout hospedado (ADR-0011, PCI SAQ-A). Os erros do Asaas passam a levar o código (`errors[].code`). Cartão: o sandbox aprovou os cartões de recusa da documentação; a recusa é provada com cartão vencido (`400 invalid_creditCard`), que vira `PaymentDeclinedError` (`PAYMENT_DECLINED`, 402). `createCheckout` (`POST /v3/checkouts`) com Pix e cartão, `externalReference` e expiração; devolve id e URL.

## T-014 — Repasse por Pix e estorno parcial [concluida]
- Refs: US-015, AC-038, AC-039
- Arquivos: apps/api/src/modules/payments/application/payment-gateway.port.ts, apps/api/src/modules/payments/domain/payment-errors.ts, apps/api/src/modules/payments/infra/asaas/asaas.gateway.ts, apps/api/test/support/asaas-sandbox.ts, apps/api/test/support/http-cassette.ts, apps/api/test/fixtures/asaas, apps/api/test/asaas-gateway.e2e-spec.ts
- Notas: depende da T-013 (precisa de saldo). `transferPix({ pixKey, amountCents, reference })` → `POST /v3/transfers` com `operationType: PIX` e `externalReference`; a idempotência é pela referência. Destino de teste: chave do Banco Central `cliente-aNNNNN@pix.bcb.gov.br`. `getAvailableBalanceCents` (da T-013) para o teste conferir o saldo; `getTransfer` para a T-015 reconsultar. `refund({ paymentId, amountCents })` → `POST /v3/payments/{id}/refund`; recusa do Asaas vira `RefundNotAllowedError` (`REFUND_NOT_ALLOWED`); a cobrança passa a trazer `refunds` e `refundedAmountCents`.
- Achados da sondagem de 13/11/2026 (vão para o relatório da T-015):
  - **`GET /v3/transfers` ignora o filtro `externalReference`** e devolve todas as transferências; a "confirmação" de 12/11 foi falso positivo (havia uma só). O adaptador percorre as páginas e compara a referência ele mesmo.
  - **Mesmo valor para a mesma chave no mesmo dia é recusado** (409 `checkout.already.requested`), mesmo com outra referência → `PixTransferDuplicateError` (`PIX_TRANSFER_DUPLICATE`). Impacto na Fase 3: dois repasses iguais à mesma loja no mesmo dia colidem.
  - **Estorno logo após o recebimento é recusado** ("Tente novamente em alguns instantes"; passa ~4 s depois). O kit de teste tenta de novo, esperando só na gravação.
  - **Estornos e transferências ficam aguardando autorização:** o estorno nasce `AWAITING_CRITICAL_ACTION_AUTHORIZATION` e as transferências seguem `PENDING`. O saldo é debitado na hora nos dois casos.
  - O cassete ganhou `value()`: valores gerados na gravação (a referência do repasse precisa ser nova a cada gravação) e reproduzidos depois.

## T-015 — Webhook do Asaas, avisos reais e relatório do spike [concluida]
- Refs: US-016, AC-040, AC-041, AC-042
- Arquivos: apps/api/prisma/schema.prisma, apps/api/prisma/migrations, apps/api/src/app.module.ts, apps/api/src/create-app.ts, apps/api/src/modules/payments/payments.module.ts, apps/api/src/modules/payments/application/asaas-event.repository.ts, apps/api/src/modules/payments/application/record-asaas-event.use-case.ts, apps/api/src/modules/payments/infra/prisma-asaas-event.repository.ts, apps/api/src/modules/payments/http/asaas-webhook.controller.ts, apps/api/test/asaas-webhook.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/spikes/asaas.md, docs/adr/0011-asaas-subcontas-e-transferencias.md, docs/adr/0012-repasse-por-pix-sem-subcontas.md, docs/API.md
- Notas: depende da T-014. `POST /v1/webhooks/asaas`, `@Public()`: token do cabeçalho `asaas-access-token` comparado com `ASAAS_WEBHOOK_TOKEN` em tempo constante (`crypto.timingSafeEqual`); sem token configurado, recusa tudo. Tabela `asaas_events` (`id` do evento único, `type`, `received_at`, `processed_at`). Processamento: grava o evento (`ON CONFLICT DO NOTHING`), já processado → 200 sem reconsultar; senão reconsulta o objeto pela porta (`getPayment`, `getTransfer`...) e marca `processed_at`. Os testes usam um gateway falso e avisos no formato da documentação, com ids de pagamentos reais do sandbox (sem captura real, ASM-014). Relatório `docs/spikes/asaas.md` responde o que a ADR-0011 deixou a validar; a ADR é atualizada com o que mudou. A ADR-0012 é corrigida: a busca por `externalReference` não filtra no Asaas (achado da T-014). Feito com repositório (porta em `application`, Prisma em `infra`), como em `identity`; o `createApp` aceita `paymentGateway` para os testes trocarem o Asaas por um falso. O caso de uso registra no log o estado reconsultado, e é por ele que o teste prova que vale a API e não o aviso (o aviso diz `RECEIVED`, a API diz `CONFIRMED`). Um aviso que falha no meio fica sem `processed_at` e é refeito no reenvio (500 faz o Asaas reenviar).
