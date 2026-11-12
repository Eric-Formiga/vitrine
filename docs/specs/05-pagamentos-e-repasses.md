# Spec 05 — Pagamentos e repasses

**Requisitos:** RF-PAY-1..4 · RN-3, RN-4, RN-11, RN-12, RN-15 · RNF-5, RNF-6, RNF-8 · **Módulos Nest:** `payments`, `payouts`

## Objetivo
Cobrar o comprador uma única vez e repassar a cada loja sua parte, menos a comissão, no momento certo — com rastreabilidade total via ledger e reconciliação com o Asaas.

## Modelo Asaas (ver [ADR-0011](../adr/0011-asaas-subcontas-e-transferencias.md))
- **Cobrança na conta da plataforma, sem split**: um Checkout hospedado por pedido (`POST /v3/checkouts`, Pix e cartão, `externalReference = orderId`, expira junto com a reserva de estoque).
- **Uma subconta por loja** (`sellers.asaas_wallet_id`). Cada sub-pedido gera, quando elegível, uma **transferência** da conta raiz para o `walletId` da loja (`POST /v3/transfers`).
- **Dinheiro disponível:** Pix é creditado na hora; cartão em **D+32**. O repasse só sai com o pagamento recebido.
- O Asaas cuida do KYC e do saque da subconta para o banco da loja.

## Estados do pagamento (no Asaas → na Vitrine)

| Asaas | Significado | Vitrine |
|---|---|---|
| `PENDING` | Checkout criado, ainda não pago | `payments.status = PENDING` |
| `CONFIRMED` | Cartão aprovado; dinheiro ainda não creditado | `CONFIRMED` → pedido **pago** |
| `RECEIVED` | Dinheiro creditado (Pix na hora; cartão em D+32) | `RECEIVED`, `received_at` → libera o repasse |
| `REFUNDED` / estorno parcial | Valor devolvido ao comprador | atualiza `amount_refunded_cents` |
| chargeback | Contestação do cartão | ver spec 07 |

## Webhook `/v1/webhooks/asaas`

| Eventos (nomes a confirmar no spike) | Ação |
|---|---|
| `PAYMENT_CONFIRMED` (cartão) · `PAYMENT_RECEIVED` (Pix) | Pedido `PAID`, sub-pedidos `AWAITING_SHIPMENT` com `ship_deadline_at`, reservas `COMMITTED` (`stock -= q`, `reserved -= q`), cupons confirmados, ledger `SALE`/`COMMISSION`/`SELLER_DISCOUNT`, carrinho esvaziado, outbox `OrderPaid` |
| `PAYMENT_RECEIVED` (cartão, D+32) | `received_at` preenchido; sub-pedidos já entregues podem ficar elegíveis |
| `CHECKOUT_EXPIRED` / `CHECKOUT_CANCELED` | Garantia de liberação da reserva (se a expiração já não fez) |
| `PAYMENT_REFUNDED` / `PAYMENT_PARTIALLY_REFUNDED` | Atualiza `refunds.status` e `payments.amount_refunded_cents` |
| `PAYMENT_CHARGEBACK_*` | Ver spec 07 |
| `TRANSFER_DONE` / `TRANSFER_FAILED` | Atualiza `transfers` e ledger |
| `ACCOUNT_STATUS_*` (subcontas) | Situação da subconta da loja (spec 02) |

**Processamento:**
1. Conferir o cabeçalho `asaas-access-token` com `ASAAS_WEBHOOK_TOKEN`, em **tempo constante**. Diferente → `401`, nada gravado. Em produção, aceitar só os IPs oficiais do Asaas.
2. `INSERT INTO asaas_events (id) ON CONFLICT DO NOTHING`; se já existia e `processed_at` não é nulo → `200` imediatamente.
3. **Não confiar no payload**: buscar o objeto na API do Asaas (`GET /v3/payments/{id}`, `/v3/transfers/{id}`...) e agir sobre o estado devolvido por ela.
4. Processar em transação; marcar `processed_at`. Erro → `500` (o Asaas reenvia).
5. Responder rápido; trabalho pesado vai para a outbox.
6. Handlers tolerantes a ordem (ex.: `PAYMENT_RECEIVED` antes de `PAYMENT_CONFIRMED` → o estado da API decide).

## Ledger
Toda movimentação de valor de um sub-pedido gera uma entrada imutável em `ledger_entries`:

| Momento | Entradas (valor com sinal, ponto de vista do vendedor) |
|---|---|
| Pagamento | `SALE +(itens+frete)`, `SELLER_DISCOUNT −desconto_loja`, `COMMISSION −comissão` |
| Repasse | `TRANSFER −valor_repassado` (zera o saldo a repassar) |
| Reembolso antes do repasse | `REFUND −valor_item`, `COMMISSION +comissão_proporcional` |
| Reembolso após repasse | igual acima → o sub-pedido fica com **saldo negativo** (dívida da loja) |
| Abatimento da dívida | `DEBT_OFFSET` no sub-pedido devedor (+) e no sub-pedido que pagou (−), no próximo repasse |

Invariante testado: `payout_amount_cents = soma(SALE, SELLER_DISCOUNT, COMMISSION, REFUND)`; após o repasse, saldo pendente = 0; a dívida da loja = soma dos saldos negativos dos seus sub-pedidos.
Job diário de reconciliação compara `payments`, `transfers` e `refunds` locais com a API do Asaas e alerta divergências (Sentry).

## Repasse (payout release)

**Elegibilidade (RN-11):** sub-pedido `DELIVERED`, `delivered_at + 7 dias ≤ agora`, **pagamento recebido** (`payments.received_at` preenchido), sem devolução aberta, sem chargeback aberto no pagamento, loja não suspensa e subconta aprovada no Asaas.

**Job `payout-release`** (diário, também agendado ao marcar entrega e ao receber `PAYMENT_RECEIVED`):
1. Seleciona elegíveis com `FOR UPDATE SKIP LOCKED`.
2. Calcula o valor: saldo do sub-pedido **menos a dívida da loja** (até zerar). Se sobrar 0, só registra o `DEBT_OFFSET` e conclui sem transferência.
3. Cria `transfers` (`PENDING`, único por sub-pedido) e chama `POST /v3/transfers { value, walletId }`. O registro local único é a idempotência; antes de repetir uma tentativa, consulta se a transferência já existe no Asaas (o Asaas recusa com 409 uma transferência idêntica nos últimos 15 min).
4. `TRANSFER_DONE` (ou retorno imediato `DONE`) → `PAID`, ledger `TRANSFER` (+ `DEBT_OFFSET`), sub-pedido `COMPLETED`, outbox `PayoutReleased` (e-mail ao vendedor).
5. Falha → `FAILED` com motivo; retry com backoff; após 5 tentativas alerta o admin.
6. Quando todos os sub-pedidos estão finalizados, pedido `COMPLETED`.

## Painel financeiro do vendedor
- Cards: **A liberar** (pagos ainda não repassados, com a data prevista), **Liberado** (últimos 30 dias), **Estornos** e **Saldo devedor** (quando houver).
- Extrato (ledger) filtrável por período, exportável em CSV.
- Para cada sub-pedido: previsão de liberação = o mais tarde entre `delivered_at + 7 dias` e a data de crédito do pagamento (cartão: D+32).
- O saque da subconta para o banco da loja é feito no Asaas.

## Casos de borda
- Comissão > base (cupom de loja enorme): base mínima 0; validação no cupom impede (spec 08).
- Subconta da loja desabilitada no Asaas na hora do repasse: transferência adiada, vendedor notificado.
- Loja com dívida e sem vendas futuras: a dívida fica visível no painel do admin; cobrança fora do sistema no MVP.
- Arredondamento: sempre inteiro em centavos; diferenças de rateio vão para o último sub-pedido; testes de propriedade (fast-check) garantem que a soma dos sub-pedidos = total cobrado.
- Sandbox: o recebimento do cartão (D+32) é simulado pela API do sandbox, para a demo mostrar o repasse no mesmo dia.
