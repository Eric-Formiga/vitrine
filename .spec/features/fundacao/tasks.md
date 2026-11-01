# Tasks: Fundação — esqueleto da Vitrine com login

> feature: fundacao

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-001 — Monorepo de pé: API e site sobem [concluida]
- Refs: US-005, AC-011
- Arquivos: package.json, pnpm-workspace.yaml, pnpm-lock.yaml, turbo.json, .gitignore, .env.example, vitest.config.ts, infra/docker-compose.yml, packages/config/package.json, packages/config/tsconfig.base.json, packages/config/eslint.config.mjs, packages/config/prettier.config.mjs, apps/api/package.json, apps/api/tsconfig.json, apps/api/nest-cli.json, apps/api/vitest.config.ts, apps/api/src/main.ts, apps/api/src/create-app.ts, apps/api/src/app.module.ts, apps/api/src/shared/health/health.module.ts, apps/api/src/shared/health/health.controller.ts, apps/api/test/health.e2e-spec.ts, apps/web/package.json, apps/web/tsconfig.json, apps/web/next.config.ts, apps/web/vitest.config.ts, apps/web/app/layout.tsx, apps/web/app/(store)/page.tsx
- Notas: vem antes de todas as outras. Turborepo + pnpm workspaces (ADR-0001), TypeScript strict, Node 24. Um Vitest na raiz com `test.projects` apontando para `apps/api` e `apps/web` (ASM-001): `pnpm vitest run` na raiz roda todos os testes. Postgres local em `infra/docker-compose.yml` com as extensões `unaccent` e `pg_trgm` (ADR-0004). Nest e Next mínimos: a API sobe e responde `GET /health/live` fora do `/v1` (ASM-003); o site faz build com uma home provisória. A montagem da API fica em `create-app.ts`, usada pelo `main.ts` e pelos testes.

## T-002 — Base da API: configuração validada, erros padronizados e logs com requestId [concluida]
- Refs: US-006, US-007, AC-013, AC-014, AC-015
- Arquivos: apps/api/package.json, pnpm-lock.yaml, .env.example, apps/api/vitest.config.ts, apps/api/src/main.ts, apps/api/src/create-app.ts, apps/api/src/app.module.ts, apps/api/src/shared/config/env.ts, apps/api/src/shared/config/env.spec.ts, apps/api/src/shared/config/config.module.ts, apps/api/src/shared/logging/logger.module.ts, apps/api/src/shared/errors/domain-error.ts, apps/api/src/shared/errors/problem-details.filter.ts, apps/api/test/errors-and-request-id.e2e-spec.ts
- Notas: variáveis validadas com Zod na subida; a mensagem de erro lista só os NOMES das variáveis, nunca valores. Filtro global gera `application/problem+json` (RFC 9457); erro inesperado vira 500 sem stack trace. Logger pino com `requestId` e cabeçalho `x-request-id`, sem dados pessoais nos logs (ARCHITECTURE §9).

## T-003 — Banco e filas no mesmo processo, com health "pronta" [pendente]

- Refs: US-005, US-008, AC-011, AC-012, AC-016, AC-017, AC-018
- Arquivos: apps/api/package.json, pnpm-lock.yaml, .env.example, apps/api/prisma/schema.prisma, apps/api/src/create-app.ts, apps/api/src/worker.ts, apps/api/src/app.module.ts, apps/api/src/shared/prisma/prisma.module.ts, apps/api/src/shared/prisma/prisma.service.ts, apps/api/src/shared/queue/job-queue.port.ts, apps/api/src/shared/queue/pg-boss.job-queue.ts, apps/api/src/shared/queue/queue.module.ts, apps/api/src/shared/queue/worker.module.ts, apps/api/src/shared/health/health.module.ts, apps/api/src/shared/health/health.controller.ts, apps/api/test/health.e2e-spec.ts, apps/api/test/queue-worker.e2e-spec.ts, apps/api/test/support/postgres-container.ts
- Notas: Prisma (ADR-0004) e pg-boss no mesmo Postgres, schema `pgboss` (ADR-0009), atrás da porta `JobQueue`. `RUN_WORKER` decide se o processo HTTP também consome as filas; `worker.ts` sobe só os consumidores (ADR-0010). Em `SIGTERM`: parar de aceitar requisições, `boss.stop({ graceful: true, timeout: 30000 })` e só então encerrar. A API precisa SUBIR mesmo com o banco fora do ar: amplie o teste do AC-011 para esse caso, e `/health/ready` responde 503. Testes de integração com Testcontainers (ASM-002); o helper `postgres-container.ts` aplica as migrações do Prisma.

## T-004 — Usuários sincronizados com o Clerk [pendente]

- Refs: US-001, AC-001, AC-002, AC-003, AC-004, AC-005
- Arquivos: apps/api/package.json, pnpm-lock.yaml, .env.example, apps/api/prisma/schema.prisma, apps/api/prisma/migrations, apps/api/src/create-app.ts, apps/api/src/app.module.ts, apps/api/src/modules/identity/identity.module.ts, apps/api/src/modules/identity/domain/user.ts, apps/api/src/modules/identity/application/user.repository.ts, apps/api/src/modules/identity/application/sync-clerk-user.use-case.ts, apps/api/src/modules/identity/infra/prisma-user.repository.ts, apps/api/src/modules/identity/http/clerk-webhook.controller.ts, apps/api/test/clerk-webhook.e2e-spec.ts, apps/api/test/support/clerk-test-kit.ts
- Notas: tabela `users` conforme o DATA_MODEL (`clerk_id` e `email` únicos, `roles text[]`, `deleted_at`, PK UUID v7). Webhook em `POST /v1/webhooks/clerk` verificando a assinatura Svix sobre o corpo RAW (`rawBody: true` no `create-app.ts`). Gravação idempotente por `clerk_id` (upsert). `user.deleted` anonimiza (o e-mail anônimo continua único) e marca `deleted_at`, sem apagar a linha. Camadas domain/application/infra/http (ADR-0002). O kit de teste gera eventos assinados com um segredo de teste.

## T-005 — Login na API: rotas privadas, perfil e cadastro na hora [pendente]

- Refs: US-002, US-003, AC-006, AC-007, AC-008
- Arquivos: apps/api/package.json, pnpm-lock.yaml, .env.example, apps/api/src/app.module.ts, apps/api/src/modules/identity/identity.module.ts, apps/api/src/modules/identity/application/clerk-gateway.port.ts, apps/api/src/modules/identity/application/provision-user.use-case.ts, apps/api/src/modules/identity/infra/clerk-backend.gateway.ts, apps/api/src/modules/identity/http/clerk-auth.guard.ts, apps/api/src/modules/identity/http/public.decorator.ts, apps/api/src/modules/identity/http/current-user.decorator.ts, apps/api/src/modules/identity/http/me.controller.ts, apps/api/src/modules/identity/http/clerk-webhook.controller.ts, apps/api/src/shared/health/health.controller.ts, apps/api/test/auth-and-me.e2e-spec.ts, apps/api/test/support/clerk-test-kit.ts
- Notas: `ClerkAuthGuard` global com `verifyToken` do `@clerk/backend` usando `jwtKey` (verificação sem rede) e `authorizedParties` = origem do site (spec 01). Rotas públicas marcadas com `@Public()`: health e webhook. Usuário carregado do banco por `clerk_id` (cache em memória de 60 s); se não existir, a API busca no Clerk pela porta `ClerkGateway` e cria o registro (AC-006) — nos testes, um fake da porta e tokens assinados com um par de chaves de teste. Papéis vêm sempre do banco (AC-008). O 401 usa o formato problem+json da T-002.

## T-006 — Site com layout, tema e login do Clerk [pendente]

- Refs: US-004, AC-009, AC-010
- Arquivos: apps/web/package.json, pnpm-lock.yaml, .env.example, apps/web/middleware.ts, apps/web/middleware.spec.ts, apps/web/postcss.config.mjs, apps/web/components.json, apps/web/app/globals.css, apps/web/app/layout.tsx, apps/web/app/(store)/page.tsx, apps/web/app/(account)/conta/page.tsx, apps/web/app/sign-in/[[...sign-in]]/page.tsx, apps/web/app/sign-up/[[...sign-up]]/page.tsx, apps/web/components/site-header.tsx, apps/web/components/ui/button.tsx, apps/web/lib/utils.ts, apps/web/lib/api/server-fetch.ts
- Notas: Tailwind + shadcn/ui (só o `button` por enquanto) e tema claro/escuro. `clerkMiddleware` protege `/conta`, `/seller` e `/admin`; o resto é público (AC-010). O teste chama o middleware com uma requisição sem sessão e confere o redirecionamento para o login com o endereço de volta (AC-009). `/conta` mostra nome, e-mail e papéis vindos de `GET /v1/me`, chamado com o token do Clerk (`server-fetch.ts`). A área do comprador fica em `/conta/...` (specs 06 e 08).
