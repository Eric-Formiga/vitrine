# Spec 05 — Pagamentos e repasses

**Requisitos:** RF-PAY-1..4 · RN-3, RN-4, RN-11, RN-12, RN-15 · RNF-5, RNF-6, RNF-8 · **Módulos Nest:** `payments`, `payouts`

## Objetivo
Cobrar o comprador uma única vez e repassar a cada loja sua parte, menos a comissão, no momento certo — com rastreabilidade total via ledger e reconciliação com o Stripe.

## Modelo Stripe (ver [ADR-0005](../adr/0005-stripe-connect-separate-charges.md))
- **Separate charges and transfers**: o PaymentIntent é criado na conta da plataforma com `transfer_group = orderId`.
- Cada sub-pedido gera, quando elegível, um `Transfer` para `seller.stripe_account_id` com `source_transaction = charge_id` (os fundos ficam vinculados à cobrança e o transfer pode ser criado antes de o saldo estar disponível).
- Contas **Express**: o Stripe cuida de KYC e do dashboard do vendedor; payouts da conta conectada para o banco do vendedor ficam no schedule padrão do Stripe.

## Webhooks

| Endpoint | Eventos | Ação |
|---|---|---|
| `/webhooks/stripe` | `payment_intent.succeeded` | Pedido `PAID`, sub-pedidos `AWAITING_SHIPMENT` com `ship_deadline_at`, reservas `COMMITTED` (`stock -= q`, `reserved -= q`), cupons confirmados, ledger `SALE`/`COMMISSION`/`SELLER_DISCOUNT`, carrinho esvaziado, outbox `OrderPaid` |
| | `payment_intent.processing` | `payments.status = PROCESSING` (Pix) |
| | `payment_intent.payment_failed` | `PAYMENT_FAILED` (reserva mantida até expirar) |
| | `payment_intent.canceled` | Garantia de liberação (se expiração já não fez) |
| | `charge.refunded` / `refund.updated` | Atualiza `refunds.status` e `payments.amount_refunded_cents` |
| | `charge.dispute.created` / `.closed` | Ver spec 07 |
| | `transfer.reversed` | Atualiza `transfers` e ledger |
| `/webhooks/stripe-connect` | `account.updated` | Status de habilitação da loja |

**Processamento:**
1. Verificar assinatura com o segredo do endpoint (`stripe.webhooks.constructEvent` com corpo **raw**). Falha → `400`.
2. `INSERT INTO stripe_events (id) ON CONFLICT DO NOTHING`; se já existia e `processed_at` não é nulo → `200` imediatamente.
3. Processar em transação; marcar `processed_at`. Erro → `500` (Stripe reenvia com backoff).
4. Responder em < 2 s; trabalho pesado vai para a outbox.
5. Handlers tolerantes a ordem (ex.: `charge.refunded` antes do registro local do refund → cria/atualiza por `stripe_refund_id`).

## Ledger
Toda movimentação de valor de um sub-pedido gera uma entrada imutável em `ledger_entries`:

| Momento | Entradas (valor com sinal, ponto de vista do vendedor) |
|---|---|
| Pagamento | `SALE +(itens+frete)`, `SELLER_DISCOUNT −desconto_loja`, `COMMISSION −comissão` |
| Repasse | `TRANSFER −valor_repassado` (zera o saldo a repassar) |
| Reembolso antes do repasse | `REFUND −valor_item`, `COMMISSION +comissão_proporcional` |
| Reembolso após repasse | igual acima + `TRANSFER_REVERSAL +valor_estornado` |

Invariante testado: `payout_amount_cents = soma(SALE, SELLER_DISCOUNT, COMMISSION, REFUND)` e, após repasse, saldo pendente = 0.
Job diário de reconciliação compara `transfers` e `refunds` locais com a API do Stripe e alerta divergências (Sentry).

## Repasse (payout release)

**Elegibilidade (RN-11):** sub-pedido `DELIVERED`, `delivered_at + 7 dias ≤ agora`, sem devolução aberta, sem disputa aberta no pagamento, loja não suspensa, `stripe_payouts_enabled`.

**Job `payout-release`** (diário e também atrasado ao marcar entrega):
1. Seleciona elegíveis com `FOR UPDATE SKIP LOCKED`.
2. Cria `transfers` (`PENDING`) e chama `stripe.transfers.create({ amount, currency: 'brl', destination, source_transaction, transfer_group, metadata: { sellerOrderId } }, { idempotencyKey: 'transfer:' + sellerOrderId })`.
3. Sucesso → `PAID`, ledger `TRANSFER`, sub-pedido `COMPLETED`, outbox `PayoutReleased` (e-mail ao vendedor).
4. Falha → `FAILED` com motivo; retry com backoff; após 5 tentativas alerta o admin.
5. Quando todos os sub-pedidos estão finalizados, pedido `COMPLETED`.

## Painel financeiro do vendedor
- Cards: **A liberar** (pagos ainda não repassados), **Liberado** (últimos 30 dias), **Estornos**.
- Extrato (ledger) filtrável por período, exportável em CSV.
- Para cada sub-pedido: previsão de liberação (`payout_eligible_at`).
- Botão "Ver no Stripe" → `POST /seller/stripe/dashboard-link` (Login Link do Express).

## Casos de borda
- Comissão > base (cupom de loja enorme): base mínima 0; validação no cupom impede (spec 08).
- Loja desabilitada no Stripe na hora do repasse: transfer adiado, vendedor notificado.
- Arredondamento: sempre inteiro em centavos; diferenças de rateio vão para o último sub-pedido; testes de propriedade (fast-check) garantem que a soma dos sub-pedidos = total cobrado.
