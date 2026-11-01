# Vitrine — Documentação de Produto e Engenharia

> Marketplace multi-vendedor de moda. Projeto de portfólio com foco em arquitetura, pagamentos distribuídos (Stripe Connect) e qualidade de engenharia.

## Índice

| Documento | Conteúdo |
|---|---|
| [PRD.md](PRD.md) | Visão, personas, escopo, requisitos funcionais e não funcionais, regras de negócio |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, diagramas, monorepo, camadas, fluxos críticos, infraestrutura, testes, CI/CD |
| [DATA_MODEL.md](DATA_MODEL.md) | Modelo de dados (ERD), máquinas de estado, invariantes, índices |
| [API.md](API.md) | Convenções REST e catálogo de endpoints |
| [ROADMAP.md](ROADMAP.md) | Fases, marcos e definição de pronto |
| [specs/](specs/) | Especificações por módulo (histórias, critérios de aceite, regras) |
| [adr/](adr/) | Architecture Decision Records |

## Specs

1. [Identidade e acesso](specs/01-identidade-e-acesso.md)
2. [Vendedores e onboarding](specs/02-vendedores-e-onboarding.md)
3. [Catálogo e busca](specs/03-catalogo-e-busca.md)
4. [Carrinho e checkout](specs/04-carrinho-e-checkout.md)
5. [Pagamentos e repasses](specs/05-pagamentos-e-repasses.md)
6. [Pedidos e entrega](specs/06-pedidos-e-entrega.md)
7. [Devoluções, reembolsos e disputas](specs/07-devolucoes-e-reembolsos.md)
8. [Cupons, avaliações e wishlist](specs/08-cupons-avaliacoes-wishlist.md)
9. [Notificações](specs/09-notificacoes.md)
10. [Painel administrativo](specs/10-painel-admin.md)

## ADRs

| # | Decisão | Status |
|---|---|---|
| [0001](adr/0001-monorepo-turborepo.md) | Monorepo com Turborepo + pnpm | Aceita |
| [0002](adr/0002-nest-monolito-modular.md) | NestJS como monólito modular em camadas | Aceita |
| [0003](adr/0003-clerk-autenticacao.md) | Clerk para autenticação; autorização no backend | Aceita |
| [0004](adr/0004-supabase-postgres-prisma.md) | Supabase (Postgres + Storage) com Prisma | Aceita |
| [0005](adr/0005-stripe-connect-separate-charges.md) | Stripe Connect Express com *separate charges and transfers* | Aceita |
| [0006](adr/0006-outbox-bullmq.md) | Transactional Outbox + BullMQ para eventos assíncronos | Substituída por 0009 |
| [0007](adr/0007-busca-postgres-fts.md) | Busca com Postgres FTS + pg_trgm | Aceita |
| [0008](adr/0008-contrato-openapi.md) | Contrato de API via OpenAPI gerado do backend | Aceita |
| [0009](adr/0009-filas-pg-boss.md) | Filas e jobs com pg-boss, sem Redis (decisão por custo) | Aceita |
| [0010](adr/0010-api-e-worker-mesmo-processo.md) | API e worker no mesmo processo em produção | Aceita |

## Convenções de rastreabilidade

- `RF-<MÓDULO>-<n>` — requisito funcional (definido no PRD, detalhado nas specs)
- `RNF-<n>` — requisito não funcional
- `RN-<n>` — regra de negócio
- Prioridade MoSCoW: **M** (Must), **S** (Should), **C** (Could), **W** (Won't nesta versão)
