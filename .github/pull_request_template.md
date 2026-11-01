## O que muda

<!-- 1 a 3 frases: o que este PR entrega e por quê. -->

## Tarefa e critérios de aceite

- Feature: `<feature>` · Tarefa: T-xxx
- Critérios cobertos: AC-xxx — <título>

## Como testar

```bash
pnpm install
pnpm vitest run
```

## Prova (spec-driven)

<!-- Cole o trecho do `onp-spec verify <feature>` com os critérios desta tarefa. -->

## Checklist

- [ ] Testes passando localmente
- [ ] Cada critério da tarefa tem teste com `@spec:AC-xxx` e prova PASS no `onp-spec verify`
- [ ] Tarefa marcada como `[concluida]` no `tasks.md`
- [ ] Nenhum segredo no código (variáveis novas documentadas no `.env.example`)
