# ADR-0010 — API e worker no mesmo processo em produção

**Status:** Aceita · **Data:** 2026-10-19 · **Complementa:** [ADR-0002](0002-nest-monolito-modular.md)

## Contexto
O ADR-0002 prevê dois entrypoints (`api` e `worker`). Com cobrança por uso no Railway, cada serviço Nest ocioso consome ~150–250 MB de RAM. Dois serviços dobram o custo sem benefício no volume de uma demo.

## Decisão
- O código mantém a separação: `src/main.ts` (HTTP), `src/worker.ts` (só filas) e um `WorkerModule` isolado.
- A variável `RUN_WORKER` controla se o processo HTTP também inicia os consumidores pg-boss:
  - **Produção (demo):** um único serviço Railway com `RUN_WORKER=true`.
  - **Escala futura:** serviço HTTP com `RUN_WORKER=false` + serviço `worker.ts`, sem mudança de código.
- *Graceful shutdown*: em `SIGTERM`, a API para de aceitar requisições, espera os jobs em andamento (`boss.stop({ graceful: true, timeout: 30000 })`) e então encerra.
- Limite de memória: `NODE_OPTIONS=--max-old-space-size=256`.

## Alternativas
- **Dois serviços desde o início**: isolamento de falhas e escala independente, com ~2× o custo.
- **Jobs só via cron externo (GitHub Actions chamando endpoints)**: barato, mas perde jobs atrasados precisos e retry.

## Consequências
- (+) ~Metade do custo; deploy e logs num lugar só.
- (−) Um job pesado pode afetar a latência da API. Mitigado com concorrência baixa por fila (`teamSize`/`batchSize` pequenos) e jobs curtos.
- (−) Deploy da API reinicia os workers. Aceitável porque os jobs são idempotentes e o pg-boss retoma o que ficou pendente.
