# ADR-0003 — Clerk para autenticação; autorização no backend

**Status:** Aceita · **Data:** 2026-10-19

## Contexto
Precisamos de login social, magic link, gestão de sessão e UI pronta, sem gastar o tempo do projeto em autenticação. A autorização (papéis, posse de recursos) é regra de negócio.

## Decisão
- **Clerk** cuida de identidade e sessão (Next via `@clerk/nextjs`; Nest valida JWT com `@clerk/backend`).
- O banco da plataforma mantém `users` (sincronizado via webhook + provisionamento *just-in-time*) e é a **fonte de verdade dos papéis**.
- Papéis são espelhados em `publicMetadata` só para a UI.

## Alternativas
- **Supabase Auth**: integra com RLS, mas a API Nest seria o único cliente do banco, então o ganho de RLS some; Clerk tem UI/DX superior.
- **Auth.js / auth própria**: mais controle, mais trabalho e superfície de segurança.

## Consequências
- (+) Auth robusta em horas; foco no domínio.
- (−) Dependência de terceiro; dados duplicados (users) exigem sincronização idempotente. Plano gratuito suficiente para o portfólio.
