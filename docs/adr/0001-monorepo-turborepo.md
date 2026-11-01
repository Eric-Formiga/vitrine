# ADR-0001 — Monorepo com Turborepo + pnpm

**Status:** Aceita · **Data:** 2026-10-19

## Contexto
Web (Next) e API (Nest) evoluem juntos e compartilham tipos (contrato da API), templates de e-mail e configurações. Dev solo, um único repositório para o portfólio.

## Decisão
Monorepo com **pnpm workspaces** e **Turborepo** (`apps/web`, `apps/api`, `packages/*`), com remote cache no CI.

## Alternativas
- **Dois repositórios**: duplicação de tipos e configs, PRs desacoplados de mudanças que atravessam as duas pontas.
- **Nx**: mais poderoso (geradores, grafo), mas mais opinativo e pesado para o tamanho do projeto.

## Consequências
- (+) Uma mudança de contrato e seu uso no web entram no mesmo PR; CI roda só o que mudou.
- (−) Deploys precisam de filtros (`turbo run build --filter=web`) e configuração de *root directory* na Vercel/Railway.
