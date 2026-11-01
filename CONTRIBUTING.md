# Como contribuir

O projeto segue um fluxo de time: nada entra na `main` sem pull request, e cada
mudança está ligada a uma tarefa e aos critérios de aceite da especificação.

## Fluxo

1. A feature é especificada em `.spec/features/<feature>/`: `spec.md` traz as
   histórias de usuário e os critérios de aceite; `tasks.md`, as tarefas.
2. Cada tarefa vira **uma branch e um PR**.
3. Todo critério de aceite vira um teste com `@spec:AC-xxx` no título.
4. O PR só é mesclado com os testes passando e a prova registrada por
   `onp-spec verify <feature>`.
5. Merge por **squash**: a `main` fica com um commit por tarefa e a branch é
   apagada.
6. A feature fecha quando `onp-spec audit --ci` sai com código 0.

## Branches

`<tipo>/<tarefa>-<resumo>`, em minúsculas e com hífens:

| Tipo | Uso | Exemplo |
|---|---|---|
| `feat/` | funcionalidade nova | `feat/t-004-sync-clerk` |
| `fix/` | correção | `fix/t-004-email-duplicado` |
| `docs/` | documentação e especificação | `docs/spec-fundacao` |
| `chore/` | configuração e ferramentas | `chore/eslint-boundaries` |
| `ci/` | pipeline | `ci/github-actions` |

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/), com o tipo
em inglês e a descrição em português:

```
feat(api): sincroniza usuários criados no Clerk

Upsert por clerk_id; assinatura Svix verificada sobre o corpo raw.

Refs: T-004, AC-001, AC-003
```

- Tipos: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`, `build`.
- Escopos: `api`, `web`, `spec`, `repo`, `infra`.
- Commits pequenos e com um propósito só; o rodapé `Refs:` liga o commit à
  tarefa e aos critérios de aceite.

## Migrações do banco

Criadas com `pnpm --filter @vitrine/api db:migrate --name <nome>`. O Prisma
coloca um carimbo de data e hora na frente; o nome descreve a mudança em
inglês e `snake_case`, no mesmo idioma do schema:

| Mudança | Nome |
|---|---|
| criar tabela | `create_users` |
| adicionar coluna | `add_phone_to_users` |
| criar índice | `add_index_products_status` |

Migração já aplicada em algum ambiente compartilhado nunca é editada nem
renomeada: corrija com uma migração nova.

## Pull requests

- Título no formato Conventional Commits: ele vira o commit na `main`.
- Descrição pelo [template](.github/pull_request_template.md): o que muda,
  critérios cobertos, como testar e a prova do `onp-spec verify`.
- Um PR por tarefa: PRs pequenos são revisados melhor.
