# Vitrine

Marketplace multi-vendedor de moda — projeto de portfólio com foco em
arquitetura, pagamentos distribuídos (Stripe Connect) e qualidade de engenharia.

> **Em construção:** Fase 0 (fundação). Acompanhe pelo [roadmap](docs/ROADMAP.md).

## Documentação

[PRD](docs/PRD.md) · [Arquitetura](docs/ARCHITECTURE.md) ·
[Modelo de dados](docs/DATA_MODEL.md) · [API](docs/API.md) ·
[ADRs](docs/adr/) · [Specs de produto](docs/specs/)

## Stack

NestJS · Next.js · PostgreSQL (Supabase) + Prisma · pg-boss · Clerk ·
Stripe Connect · Turborepo + pnpm · Vitest · Playwright

## Como o projeto é desenvolvido

Spec-driven: cada feature tem uma especificação executável em `.spec/features/`,
e cada critério de aceite vira um teste. Fluxo de branches, commits e pull
requests em [CONTRIBUTING.md](CONTRIBUTING.md).
