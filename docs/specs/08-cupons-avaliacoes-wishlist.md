# Spec 08 — Cupons, avaliações e wishlist

**Requisitos:** RF-CHK-2, RF-ENG-1..3, RF-ADM-2 · RN-12, RN-13, RN-14 · **Módulos Nest:** `promotions`, `reviews`, `catalog`

## Cupons

### Tipos
| Emissor | Escopo | Custeio | Limite por pedido |
|---|---|---|---|
| Plataforma | todos os itens elegíveis do carrinho | plataforma | 1 |
| Loja | itens daquela loja | loja | 1 por loja |

Valor: `PERCENT` (em bps) ou `FIXED` (centavos). Opções: mínimo de subtotal, teto de desconto, validade, limite total, limite por usuário, "somente primeira compra" (plataforma).

### Ordem de aplicação
1. Cupons de loja sobre o subtotal de cada loja.
2. Cupom de plataforma sobre a soma das bases resultantes (sem frete), rateado proporcionalmente entre as lojas (resto de centavos na última).
3. Desconto nunca torna base < 0 nem atinge frete.

### Critérios de aceite
- Código case-insensitive; inválido/expirado/esgotado/fora do mínimo → erro específico (`COUPON_INVALID`, `COUPON_NOT_APPLICABLE` com `detail`).
- Cupom é revalidado no `POST /checkout`; `used_count` incrementado atomicamente (`WHERE used_count < usage_limit`) na criação do pedido e revertido na expiração/cancelamento.
- Cupom de plataforma tem `max_discount_cents` obrigatório (controle de risco: plataforma não pode perder mais que a comissão em escala).
- Cupom de loja: vendedor só cria para a própria loja; desconto máximo 50% (evita base de comissão irrisória).

## Avaliações

### Critérios de aceite
- Disponível para cada `order_item` de sub-pedido `DELIVERED`/`COMPLETED`; uma avaliação por item (RN-14). Badge "Compra verificada".
- Nota 1–5 (obrigatória), título, texto (≤ 2000), até 3 fotos, e "Como serviu?" (pequeno/certo/grande) — dado útil para moda, agregado na PDP ("72% dizem que veste certo").
- Editável por 30 dias. Vendedor pode responder uma vez (público).
- Agregados `rating_avg`/`rating_count` de produto e loja atualizados por evento (`ReviewPublished`).
- Admin pode ocultar (moderação) com motivo; denúncia por usuários (Could).
- Filtro simples de palavrões/links na criação → status `PENDING_MODERATION` em vez de publicar.

## Wishlist
- Coração na PDP e nos cards; visitante é levado ao login e o item é adicionado após autenticar.
- `/conta/favoritos` com disponibilidade e preço atuais.
- (Should) E-mail "baixou de preço" quando produto favoritado reduz ≥ 10% — job diário.
