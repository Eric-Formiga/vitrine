# Tasks: Categorias — árvore do catálogo, admin e contrato da API

> feature: categorias

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

## T-007 — Papel admin, auditoria e seed do admin [concluida]
- Refs: US-009, US-010, US-013, AC-019, AC-020, AC-021, AC-022
- Arquivos: package.json, apps/api/package.json, apps/api/prisma/schema.prisma, apps/api/prisma/migrations, apps/api/src/app.module.ts, apps/api/src/shared/prisma/prisma.service.ts, apps/api/src/shared/auth/roles.decorator.ts, apps/api/src/shared/auth/roles.guard.ts, apps/api/src/shared/audit/audit.module.ts, apps/api/src/shared/audit/audited.decorator.ts, apps/api/src/shared/audit/audit-trail.ts, apps/api/src/shared/audit/audit-log.interceptor.ts, apps/api/src/modules/identity/identity.module.ts, apps/api/src/modules/identity/application/user.repository.ts, apps/api/src/modules/identity/infra/prisma-user.repository.ts, apps/api/src/modules/identity/application/grant-admin.use-case.ts, apps/api/src/scripts/seed-admin.ts, apps/api/test/admin-access.e2e-spec.ts, apps/api/test/seed-admin.e2e-spec.ts, apps/api/test/support/admin-test-kit.ts
- Notas: vem antes das outras. `@Roles('admin')` + `RolesGuard` global (roda depois do `ClerkAuthGuard`, lê os papéis já carregados do banco): sem o papel → 404 problem+json, igual a rota inexistente (spec 10). Os testes de AC-021/AC-022 montam um controller de teste em `/admin/...` pelo `imports` do `createApp`. Tabela `audit_logs` conforme o DATA_MODEL (PK UUID v7, `before`/`after` jsonb, `ip`). Auditoria declarativa: `@Audited('category.update')` no handler + interceptor que grava só quando a resposta é sucesso; o handler devolve o antes/depois (ou o caso de uso os informa) — o critério AC-030 é provado na T-008, com as rotas reais. `pnpm seed:admin --email <e-mail>` na raiz chama `apps/api/src/scripts/seed-admin.ts`; a lógica fica no caso de uso `GrantAdminUseCase` (testável sem processo filho) e o script devolve código de saída ≠ 0 com mensagem clara quando não acha a conta ativa. Adicionar `admin` é idempotente (não repete o papel).

## T-008 — Categorias na API: árvore pública e manutenção pelo admin [concluida]
- Refs: US-010, US-011, US-012, US-013, AC-022, AC-023, AC-026, AC-027, AC-028, AC-029, AC-030, AC-033
- Arquivos: apps/api/package.json, pnpm-lock.yaml, apps/api/prisma/schema.prisma, apps/api/prisma/migrations, apps/api/src/app.module.ts, apps/api/src/create-app.ts, apps/api/src/shared/errors/domain-error.ts, apps/api/src/shared/errors/problem-details.filter.ts, apps/api/src/shared/validation/zod-validation.ts, apps/api/src/shared/validation/id-param.pipe.ts, apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/domain/category.ts, apps/api/src/modules/catalog/domain/category-errors.ts, apps/api/src/modules/catalog/domain/size-chart.ts, apps/api/src/modules/catalog/domain/slugify.ts, apps/api/src/modules/catalog/domain/slugify.spec.ts, apps/api/src/modules/catalog/application/category.repository.ts, apps/api/src/modules/catalog/application/get-category-tree.use-case.ts, apps/api/src/modules/catalog/application/create-category.use-case.ts, apps/api/src/modules/catalog/application/update-category.use-case.ts, apps/api/src/modules/catalog/application/archive-category.use-case.ts, apps/api/src/modules/catalog/application/restore-category.use-case.ts, apps/api/src/modules/catalog/infra/prisma-category.repository.ts, apps/api/src/modules/catalog/http/category.dto.ts, apps/api/src/modules/catalog/http/categories.controller.ts, apps/api/src/modules/catalog/http/admin-categories.controller.ts, apps/api/test/categories.e2e-spec.ts, apps/api/test/admin-categories.e2e-spec.ts, docs/DATA_MODEL.md, docs/API.md, docs/adr/0008-contrato-openapi.md
- Notas: depende da T-007 (papel admin e auditoria). Módulo `catalog` em camadas (ADR-0002). Tabela `categories` do DATA_MODEL + `size_type` (`CLOTHING`|`SHOES`|`ONE_SIZE`, ASM-005) + `archived_at` (ASM-011); `slug` único global, inclusive entre arquivadas (ASM-006). DTOs em Zod 4 nativo (ASM-010 invalidada: `nestjs-zod` não suporta Nest 12) com `ZodValidationPipe` próprio: erro de entrada vira 400 problem+json com `errors` por campo (AC-027). Id fora do formato UUID responde 404, como id inexistente. Novos códigos de domínio: `SLUG_TAKEN` (409) e `INVALID_CATEGORY_PARENT` (422) — documentar no API.md junto com `POST /admin/categories/{id}/restore`. Árvore montada em memória a partir de uma consulta só (são poucas dezenas de categorias). Arquivar em cascata numa transação (CTE recursiva ou varredura em memória), com o registro de auditoria listando as descendentes. Guia de medidas validado como `{ columns, rows }` (ASM-008). Admin vê a lista com as arquivadas (`archivedAt`).

## T-009 — Seed da árvore inicial de moda [pendente]
- Refs: US-011, AC-024
- Arquivos: apps/api/package.json, apps/api/prisma.config.ts, apps/api/prisma/seed/categories.ts, apps/api/prisma/seed/index.ts, apps/api/test/seed-categories.e2e-spec.ts
- Notas: depende da T-008 (tabela). `pnpm db:seed` (Prisma `migrations.seed`). Departamentos Feminino, Masculino, Calçados e Acessórios com subcategorias de moda, slugs explícitos e únicos (`vestidos-femininos`, `tenis-masculinos`...), tipo de tamanho certo em cada uma e guia de medidas nas de roupa e calçado. Upsert por slug: rodar de novo não duplica nada. Categoria que já existe não é alterada (o seed só cria o que falta), para não desfazer o que o admin mudou depois.

## T-010 — Contrato OpenAPI, Swagger em /docs e cliente tipado [pendente]
- Refs: US-014, AC-031, AC-032
- Arquivos: package.json, turbo.json, apps/api/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, apps/api/src/create-app.ts, apps/api/src/shared/openapi/openapi.ts, apps/api/src/scripts/generate-openapi.ts, apps/api/test/openapi.e2e-spec.ts, packages/api-client/package.json, packages/api-client/tsconfig.json, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, packages/api-client/src/index.ts
- Notas: depende da T-008 (rotas de categorias com DTOs Zod). `@nestjs/swagger` + `nestjs-zod` geram o documento; Swagger UI em `/docs` e JSON em `/docs/openapi.json`, ambos `@Public()` e fora do `/v1` (ASM-009). Bearer auth declarado. `pnpm api:generate` (raiz) monta o app sem subir porta, grava `packages/api-client/openapi.json` e gera `src/schema.d.ts` com `openapi-typescript`. `packages/api-client` exporta `createApiClient(baseUrl)` com `openapi-fetch`. Teste do AC-032: gera o documento em memória e compara com o `openapi.json` versionado; diferença → falha com a mensagem "rode pnpm api:generate".

## T-011 — Menu de departamentos no site [pendente]
- Refs: US-011, AC-025
- Arquivos: apps/web/package.json, pnpm-lock.yaml, apps/web/vitest.config.ts, apps/web/lib/api/public-client.ts, apps/web/lib/api/categories.ts, apps/web/lib/api/categories.spec.ts, apps/web/components/category-menu.tsx, apps/web/components/category-menu.spec.tsx, apps/web/components/site-header.tsx
- Notas: depende da T-010 (cliente tipado). O site lê a árvore com o cliente público do `@vitrine/api-client` (sem token). `loadDepartments()` devolve `[]` se a API falhar ou estiver fora do ar — o site nunca quebra por causa do menu. `CategoryMenu` recebe os departamentos e renderiza links `/c/{slug}`; o teste renderiza com `react-dom/server`. Cache e `revalidateTag` ficam para a feature `vitrine`.
