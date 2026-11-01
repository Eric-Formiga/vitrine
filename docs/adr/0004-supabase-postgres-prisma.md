# ADR-0004 — Supabase (Postgres + Storage) com Prisma

**Status:** Aceita · **Data:** 2026-10-19

## Contexto
Precisamos de Postgres gerenciado (transações, FTS, constraints fortes) e storage de imagens com CDN, com custo zero no início.

## Decisão
- **Supabase** como Postgres gerenciado e **Supabase Storage** para imagens. Não usamos Supabase Auth nem acesso direto do cliente ao banco.
- **Prisma** como ORM e ferramenta de migração. Consultas críticas (reserva de estoque, busca FTS, facetas) usam `$queryRaw` tipado (TypedSQL) onde o Prisma Client não expressa bem.
- Conexão da API via pooler do Supabase (modo transação) e `directUrl` para migrações.
- Localmente, Postgres puro no Docker Compose (com extensões `unaccent`, `pg_trgm`).

## Alternativas
- **Drizzle**: SQL mais explícito e leve; Prisma escolhido pela maturidade com Nest, migrações e familiaridade.
- **Neon / RDS**: Neon é ótima opção; Supabase escolhido por incluir Storage.

## Consequências
- (+) Banco relacional forte, FTS nativo, storage integrado, plano gratuito.
- (−) Projeto gratuito do Supabase pausa após inatividade — mitigado com health check agendado. Parte das queries em SQL cru exige testes de integração.
