# ADR-0011 — Asaas com subcontas, Checkout hospedado e repasse por transferência

**Status:** Aceita, com a parte de subcontas substituída pela [ADR-0012](0012-repasse-por-pix-sem-subcontas.md) (repasse por Pix para a chave da loja) · **Data:** 2026-11-12 · Substitui a [ADR-0005](0005-stripe-connect-separate-charges.md)

## Contexto
A Vitrine é um marketplace brasileiro: um carrinho com itens de várias lojas é pago numa única cobrança, a plataforma retém a comissão, segura o dinheiro até a entrega + janela de arrependimento e reembolsa parcialmente por loja (ADR-0005 resolvia isso com Stripe Connect).

O Asaas atende o mercado brasileiro de forma nativa (Pix, KYC das lojas, sandbox gratuito) e foi escolhido pelo dono do produto em 12/11/2026. O modelo dele é diferente do Stripe:
- Cada loja é uma **subconta** do Asaas, criada por API (`POST /v3/accounts`), com um `walletId`; o Asaas faz o KYC.
- O **split na cobrança** é executado automaticamente **no recebimento** do pagamento. Não há como segurá-lo até a entrega.
- Para transferir depois, a conta raiz faz uma **transferência para o `walletId`** da subconta (`POST /v3/transfers`), normalmente imediata.
- Cartão de crédito é creditado em **D+32** (cada parcela); Pix, na hora.
- Os webhooks **não são assinados**: o Asaas envia um token fixo no cabeçalho `asaas-access-token`.

## Decisão
- **Subconta por loja**, criada quando o admin aprova a loja. Guardamos `asaas_account_id` e `asaas_wallet_id`; a chave de API da subconta **não** é guardada.
- **Cobrar na conta da plataforma e transferir depois** (sem split na cobrança): uma cobrança por pedido; cada sub-pedido gera, quando elegível, uma transferência para o `walletId` da loja. É o equivalente ao *separate charges and transfers* da ADR-0005.
- **Checkout hospedado do Asaas** (`POST /v3/checkouts`) com **Pix e cartão de crédito**. O comprador paga na página do Asaas e volta para a Vitrine; os dados do cartão nunca passam pela Vitrine (PCI SAQ-A).
- **Repasse só com o dinheiro disponível:** além da regra de negócio (entrega + 7 dias, RN-11), o pagamento precisa estar **recebido** no Asaas (Pix na hora; cartão em D+32).
- **Reembolso** sempre pela cobrança da plataforma (`POST /v3/payments/{id}/refund`, parcial). Se o repasse já ocorreu, a parte da loja vira **dívida no ledger**, descontada dos próximos repasses (sem puxar dinheiro de volta da subconta).
- **Webhook** em `POST /v1/webhooks/asaas`: token comparado em tempo constante, idempotência pelo `id` do evento e, antes de mudar estado, **reconsulta do objeto na API do Asaas** (o payload não é confiável por si só).
- Tudo atrás da porta `PaymentGateway`; testes de unidade e integração usam um `FakePaymentGateway`.

## Alternativas
- **Split automático na cobrança**: muito mais simples, mas a loja recebe antes da entrega; perde a retenção e deixa a devolução dependendo do saldo da loja.
- **Puxar o valor de volta da subconta após o repasse**: exige guardar (criptografada) a chave de API de cada subconta e falha se a loja já sacou.
- **Formulário de cartão próprio** (API direta ou tokenização): melhor UX, mas o cartão passa pelo backend (SAQ-D) ou exige integração extra; o Checkout hospedado resolve com escopo PCI mínimo.
- **Manter o Stripe Connect** (ADR-0005): bom ferramental de testes, mas Connect e Pix para plataforma brasileira em produção eram um risco aberto.
- **Boleto**: compensa em D+1 a D+3 e obrigaria reservas de estoque de dias; fora do MVP.

## Consequências
- (+) Pix nativo (o meio mais usado no Brasil), KYC das lojas pelo Asaas, uma cobrança para N lojas e controle do momento do repasse.
- (+) Sem chave de subconta guardada: menos segredo para proteger.
- (−) A plataforma é responsável pela cobrança, pelas taxas do Asaas e pelos chargebacks → ledger, bloqueio de repasse e dívida da loja (specs 05 e 07).
- (−) Repasse de cartão espera D+32 (sem antecipação). Em sandbox o recebimento é simulado; em produção, a antecipação (paga) é uma opção.
- (−) Webhook sem assinatura: a segurança vem do token, da restrição de IP em produção e da reconsulta na API.
- (−) Sem CLI de webhook local como o `stripe listen`: em desenvolvimento, os avisos chegam por um túnel (ex.: `cloudflared`) ou por simulação nos testes.
- **A validar no spike (`spike-asaas`):** aprovação automática de subconta no sandbox; criação do Checkout com Pix + cartão e expiração em 15 min; nomes e ordem dos eventos (pagamento, checkout, transferência, chargeback, situação da conta); transferência para `walletId` e sua idempotência; estorno parcial de Pix e cartão; custo das transferências entre contas.

## Resultado do spike (13/11/2026)
O relatório completo está em [docs/spikes/asaas.md](../spikes/asaas.md). Resumo:
- **Subcontas:** recusadas para conta PF → repasse por Pix ([ADR-0012](0012-repasse-por-pix-sem-subcontas.md)).
- **Checkout:** confirmado com Pix + cartão, expiração de 15 min e `externalReference`.
- **Webhook:** feito como decidido aqui: token em tempo constante, idempotência pelo `id` do evento (tabela `asaas_events`) e reconsulta na API. A ordem dos eventos fica para a Fase 2, com captura real.
- **Estorno parcial de Pix:** funciona depois de alguns segundos do recebimento e fica aguardando autorização de ação crítica. O estorno de cartão não foi testado.
- **Transferências:** sem taxa no sandbox. Ficam `PENDING` até a autorização de ação crítica, e o caminho até `DONE` ainda precisa ser validado antes da Fase 3.
- **Cartão no sandbox:** os cartões de recusa da documentação foram aprovados; só o cartão vencido é recusado.
