# ADR-0006 — Transactional Outbox + BullMQ

**Status:** Substituída por [ADR-0009](0009-filas-pg-boss.md) **por motivo de custo** (a parte de outbox continua valendo) · **Data:** 2026-10-19

## Contexto
Após mudanças de estado (pedido pago, despacho) precisamos disparar efeitos colaterais (e-mails, revalidação de cache, agendamento de timers, sincronização com Clerk). Publicar direto numa fila após o commit pode perder eventos se o processo cair entre commit e publish.

## Decisão
- Casos de uso gravam eventos em `outbox_events` **na mesma transação** da mudança de estado.
- Um *relay* no worker lê eventos não publicados (`FOR UPDATE SKIP LOCKED`), publica em filas **BullMQ** (Redis) e marca `published_at`.
- Jobs agendados/atrasados (expiração de reserva, auto-entrega, repasse) também em BullMQ.
- Consumidores idempotentes; retries exponenciais; DLQ.

## Alternativas
- **EventEmitter em memória do Nest**: perde eventos em crash; não distribui entre instâncias.
- **RabbitMQ/Kafka**: mais infraestrutura sem necessidade nesse volume.
- **pg-boss** (fila no Postgres): menos uma peça, mas BullMQ tem melhor ecossistema/painel (Bull Board) e jobs atrasados maduros.

## Consequências
- (+) Entrega *at-least-once* garantida; efeitos desacoplados dos casos de uso.
- (−) Redis como dependência adicional (Upstash gratuito); latência de ~1 s nos efeitos.
