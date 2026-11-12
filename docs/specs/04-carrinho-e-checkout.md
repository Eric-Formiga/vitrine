# Spec 04 — Carrinho e checkout

**Requisitos:** RF-CART-1..3, RF-CHK-1..5 · RN-5, RN-6, RN-7, RN-13 · RNF-1, RNF-4 · **Módulos Nest:** `cart`, `checkout`

## Objetivo
Permitir montar um carrinho com produtos de várias lojas e pagar tudo de uma vez, garantindo preço correto, estoque reservado e nenhuma cobrança duplicada.

## Carrinho

### H1 — Carrinho de visitante e merge
- Visitante: API cria carrinho com `anonymous_token` e o web guarda em cookie `httpOnly` `cart_token` (30 dias).
- Ao logar, o web chama `POST /cart/merge`: itens somados por variante, quantidade limitada ao estoque disponível; carrinho anônimo é removido.

### H2 — Leitura sempre revalidada
`GET /cart` retorna itens **agrupados por loja** e, para cada item, recalcula com dados atuais:
- `priceChanged` (com preço antigo e novo), `availableQuantity`, `unavailable` (produto arquivado/loja inapta).
- Quantidade acima do disponível é ajustada e sinalizada com `adjusted: true`.
- Totais: subtotal por loja, frete por loja (se CEP informado), descontos, total geral.

### H3 — Regras de quantidade
- 1 ≤ quantidade ≤ min(10, disponível). Adicionar variante existente soma quantidade.
- Carrinho com no máximo 50 itens distintos.

## Checkout

### Página
Etapas numa única página: **Endereço → Frete (por loja, informativo) → Revisão (itens por loja, cupons) → Pagamento (Checkout hospedado do Asaas: Pix ou cartão)**.

### H4 — Iniciar pagamento (`POST /checkout`)
Requisição: `{ addressId }` + header `Idempotency-Key`.

Em **uma transação** (isolamento `READ COMMITTED` + UPDATEs condicionais):
1. Carrega carrinho do usuário; falha se vazio.
2. Revalida preços/estoque/aptidão da loja. Se algo mudou desde a última leitura exibida → `409 PRICE_CHANGED` / `OUT_OF_STOCK` com detalhes; UI atualiza revisão.
3. Calcula frete por loja e cupons (ver spec 08).
4. Para cada variante: `UPDATE product_variants SET reserved = reserved + q WHERE id = ? AND stock - reserved >= q`. Linhas afetadas = 0 → aborta com `OUT_OF_STOCK`.
5. Cria `orders` (`PENDING_PAYMENT`, `reservation_expires_at = now + 15 min`), `seller_orders` (`AWAITING_PAYMENT`, comissão congelada), `order_items` (snapshot), `stock_reservations`, `coupon_redemptions` (provisórias).
6. Grava evento outbox `OrderCreated` (agenda job de expiração).

Fora da transação (após commit):
7. `PaymentGateway.createCheckout({ orderId, amountCents: grandTotal, billingTypes: ['PIX', 'CREDIT_CARD'], expiresAt, successUrl, cancelUrl })` → `POST /v3/checkouts` com `externalReference = orderId`, na conta da plataforma (sem split; ADR-0011). Antes de criar, procura um Checkout já existente para o pedido, para a repetição não gerar dois.
8. Grava `payments` com `asaas_checkout_id`. Retorna `{ orderId, checkoutUrl, expiresAt }`; o site redireciona o comprador para o `checkoutUrl`.

Se o passo 7 falhar: job de compensação libera reservas e marca pedido `PAYMENT_FAILED`; cliente recebe `502` e pode tentar novamente com nova chave.

**Idempotência:** mesma `Idempotency-Key` + mesmo hash de payload → mesma resposta salva; payload diferente → `422 IDEMPOTENCY_CONFLICT`. Chaves expiram em 24 h.

**Pedido pendente existente:** se o usuário já tem pedido `PENDING_PAYMENT` não expirado com o mesmo conteúdo, a API devolve ele em vez de criar outro.

### H5 — Pagamento
- Redireciona para o Checkout hospedado do Asaas (Pix com QR Code e copia-e-cola; cartão de crédito). Na volta, `/checkout/sucesso?order=...` acompanha o status por polling; quem confirma o pagamento é o webhook, nunca a volta do comprador.
- Contador visível do tempo de reserva.
- `return_url` = `/checkout/confirmacao?order={id}`.

### H6 — Confirmação
- Página faz polling em `GET /checkout/{orderId}/status` a cada 2 s (até 60 s): `PENDING_PAYMENT | PROCESSING | PAID | PAYMENT_FAILED | EXPIRED`.
- `PAID`: mostra número do pedido, sub-pedidos por loja e prazos; carrinho é esvaziado (no webhook, não no redirect).
- `PAYMENT_FAILED`: permite tentar de novo (outro cartão ou Pix) **no mesmo Checkout** enquanto a reserva não expirar.

### H7 — Expiração
- Job atrasado em 15 min: se pedido ainda não pago → expira o Checkout no Asaas, `reserved -= q`, reservas `RELEASED`, cupons liberados, pedido `EXPIRED`.
- Corrida webhook × expiração: ambos atualizam com `WHERE status = 'PENDING_PAYMENT'`; quem perder não faz nada. Se o pagamento for confirmado após a expiração (raro, ex.: Pix tardio) → reembolso automático integral e e-mail explicativo.

## Testes obrigatórios
- Integração: duas requisições simultâneas pelo último item → exatamente uma `201`, uma `409`.
- Integração: replay da mesma `Idempotency-Key` → mesma resposta, um só pedido.
- k6: 200 usuários virtuais pelo mesmo item com estoque 1.
- E2E: carrinho com 2 lojas, pagamento no sandbox do Asaas (cartão de teste e Pix simulado), pedido pago com 2 sub-pedidos.
