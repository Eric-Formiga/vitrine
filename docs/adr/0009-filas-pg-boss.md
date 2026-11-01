# ADR-0009 — Filas e jobs com pg-boss (sem Redis)

**Status:** Aceita · **Data:** 2026-10-19 · **Substitui:** [ADR-0006](0006-outbox-bullmq.md)

> **Motivo principal: custo.** A troca não foi por limitação técnica do Redis/BullMQ, que continuam sendo a escolha preferida para alto volume. Ela foi feita para manter a infraestrutura da demo dentro de ~US$ 5/mês (RNF-18), eliminando um serviço pago.

## Contexto
O ADR-0006 escolheu BullMQ + Redis. Ao planejar o deploy com orçamento de ~US$ 5/mês, isso se mostrou caro:
- O BullMQ consulta o Redis continuamente mesmo sem jobs; em Redis cobrado por comando (Upstash free) o limite mensal estoura em dias.
- Redis rodando no Railway consome memória permanente e divide o crédito com a API.
- O volume de jobs do projeto é baixo (dezenas a centenas por dia).

## Decisão
- **pg-boss** como fila e agendador, usando o próprio Postgres do Supabase (schema `pgboss`).
- O padrão **Transactional Outbox** do ADR-0006 continua: eventos gravados em `outbox_events` na mesma transação; o relay publica em filas pg-boss.
- Jobs atrasados (`startAfter`) para expiração de reserva, auto-entrega e repasse; jobs recorrentes (`schedule`, cron) para rotinas diárias.
- Retry com backoff exponencial e fila de *dead letter* por fila.
- Conexão do pg-boss pelo **session pooler** do Supabase (o transaction pooler não suporta sessões longas), com pool pequeno (`max: 3`) para respeitar o limite de conexões do plano gratuito.
- **Cache e rate limit em memória** (LRU no processo e storage padrão do `@nestjs/throttler`), já que a demo roda em uma instância.

## Alternativas
- **BullMQ + Redis (ADR-0006)**: melhor ecossistema e painel (Bull Board), mas custo e uma peça a mais de infraestrutura.
- **Redis apenas quando escalar**: mantido como caminho futuro, atrás das portas `JobQueue`, `CacheStore` e storage do throttler.
- **Cron do próprio Nest (`@nestjs/schedule`)**: sem persistência, retry ou jobs atrasados que sobrevivam a restart.

## Consequências
- (+) Um serviço a menos; custo zero de fila; jobs e dados no mesmo banco (backup e inspeção juntos, consulta SQL direta na tabela de jobs).
- (+) Possibilidade futura de enfileirar o job direto na transação de negócio, dispensando o relay.
- (−) Carga extra no Postgres (polling do pg-boss); aceitável no volume do projeto e configurável (`pollingIntervalSeconds`).
- (−) Sem painel pronto: o admin terá uma tela simples lendo as estatísticas das filas (pendentes, falhas, dead letter).
- (−) Cache e rate limit em memória **não funcionam com várias instâncias**. Para escalar horizontalmente, trocar os adapters por Redis. Isso está documentado e não exige mudar os casos de uso.
