# ADR-0002 — NestJS como monólito modular em camadas

**Status:** Aceita · **Data:** 2026-10-19

## Contexto
O domínio tem contextos claros (catálogo, pedidos, pagamentos, repasses…) com fluxos transacionais que atravessam vários deles (checkout). Microsserviços trariam transações distribuídas e custo operacional sem benefício para um dev solo.

## Decisão
Um único serviço NestJS dividido em **módulos por contexto de negócio**, cada um com camadas `domain → application → infra/http`. Comunicação entre módulos por serviços públicos explícitos ou eventos de domínio (outbox). Mesmo código com dois entrypoints: `api` (HTTP) e `worker` (filas/jobs). Em produção, ambos rodam no mesmo processo ([ADR-0010](0010-api-e-worker-mesmo-processo.md)).

## Alternativas
- **Microsserviços**: isolamento real, mas sagas, observabilidade distribuída e deploys múltiplos — complexidade não justificada.
- **Nest "padrão" (controller → service → Prisma)**: mais rápido no início, mas regras de negócio espalhadas e difíceis de testar sem banco.

## Consequências
- (+) Transações locais simples; domínio testável sem infraestrutura; fronteiras prontas para extrair serviços no futuro.
- (−) Mais arquivos/boilerplate (portas, adapters, mappers). Disciplina de fronteiras garantida por regra de lint (`eslint-plugin-boundaries`) proibindo importar `infra/` de outro módulo.
