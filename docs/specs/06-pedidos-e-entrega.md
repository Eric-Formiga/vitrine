# Spec 06 — Pedidos e entrega

**Requisitos:** RF-ORD-1..5 · RN-5, RN-7, RN-8, RN-9 · **Módulo Nest:** `orders`

## Objetivo
Cada loja gerencia o despacho dos seus itens de forma independente, enquanto o comprador acompanha o pedido inteiro num só lugar.

Máquinas de estado: ver [DATA_MODEL.md §3](../DATA_MODEL.md#3-máquinas-de-estado).

## Histórias e critérios de aceite

### H1 — Visão do comprador
- `/conta/pedidos`: lista com número, data, total, status agregado ("Em andamento", "Concluído", "Cancelado").
- Detalhe: endereço, pagamento (método, últimos 4 dígitos), e um bloco **por loja** com itens, status, timeline (Pago → Enviado → Entregue), código de rastreio com link para o site da transportadora, e ações disponíveis (confirmar recebimento, solicitar devolução, avaliar, cancelar por atraso).

### H2 — Visão do vendedor
- `/seller/pedidos`: abas por status (A enviar · Enviados · Entregues · Devoluções · Cancelados), com destaque para os que vencem em < 24 h.
- Detalhe: itens com SKU, endereço de entrega, valor a receber (após comissão), previsão de repasse.
- Etiqueta/declaração de conteúdo em PDF simples (Could).

### H3 — Despacho
- `POST /seller/orders/{id}/ship { carrier, trackingCode }` só em `AWAITING_SHIPMENT`.
- `carrier` ∈ {Correios, Jadlog, Loggi, Outro}; código validado por formato para Correios (`AA123456789BR`).
- Grava `shipped_at`, agenda `auto-confirm-delivery` (15 dias), e-mail ao comprador.

### H4 — Prazo de despacho (RN-8)
- `ship_deadline_at = paid_at + handling_days` em dias úteis (máx. 3; feriados nacionais via tabela).
- Vencido: comprador ganha a ação "Cancelar e receber reembolso"; job notifica vendedor 24 h antes.
- Atrasos contam na métrica de reputação da loja (taxa de atraso, visível ao admin).

### H5 — Entrega
- Comprador confirma recebimento → `DELIVERED`, `delivered_at`, `payout_eligible_at = +7 dias`, convite para avaliar.
- Sem confirmação em 15 dias após despacho → auto `DELIVERED` (job diário).
- Comprador pode reportar "não recebi" antes da auto-confirmação → abre caso para o admin e pausa o timer.

### H6 — Cancelamento pelo vendedor
- Permitido em `AWAITING_SHIPMENT` com motivo (sem estoque, erro de preço…).
- Reembolso integral do sub-pedido (itens + frete − rateio de cupom), reposição de estoque, ledger ajustado, e-mails.
- Cancelamentos frequentes geram alerta ao admin.

### H7 — Agregação do status do pedido
- `Order.COMPLETED` quando todos os sub-pedidos estão em estado final (`COMPLETED`, `REFUNDED`, `CANCELED`) e ao menos um `COMPLETED`; `CANCELED` se todos cancelados/reembolsados.

## Eventos
`OrderPaid`, `SellerOrderShipped`, `SellerOrderDelivered`, `SellerOrderCanceled`, `ShipDeadlineApproaching`, `OrderCompleted`.

## v2
Integração com Melhor Envio para cotação real, compra de etiqueta e rastreio automático (webhooks de status).
