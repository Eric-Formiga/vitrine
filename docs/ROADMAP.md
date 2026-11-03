# Roadmap — Vitrine

Fases incrementais: cada fase termina com algo **deployado e demonstrável**.

> **Linha de corte do portfólio.** O núcleo são as **Fases 0 a 3 + Entrega do portfólio**: é onde estão os diferenciais (checkout multi-loja sem overselling, divisão do pagamento com Stripe Connect, repasse, reembolso com estorno). As **Fases 4 e 5 são bônus** e só começam depois que o núcleo estiver publicado e demonstrável; o que não for feito entra como "próximos passos" no README. O [PRD](PRD.md) (§4.1) continua descrevendo o escopo completo — a linha de corte define a ordem de entrega.

## Fase 0 — Fundação
- [x] Monorepo Turborepo + pnpm, configs compartilhadas (TS strict, ESLint, Prettier) — feature `fundacao`
- [x] Docker Compose (Postgres); `.env.example` — feature `fundacao`
- [x] pg-boss + flag `RUN_WORKER` + graceful shutdown — feature `fundacao`
- [x] Nest: módulo `shared` (Prisma, config com validação Zod, logger pino, filtro problem+json, health) — feature `fundacao`
- [x] Next: layout base, Tailwind, shadcn/ui, tema — feature `fundacao`
- [x] Clerk em ambos + webhook de sincronização de usuários — feature `fundacao`
- [ ] Pipeline CI (lint, typecheck, test, build) e deploy de esqueleto (Vercel + Railway + Supabase) — feature `ci-e-deploy` (adiada: depois da Fase 1)
- [ ] **Spike Stripe Connect**: criar conta Express de teste, Account Link, PaymentIntent com `transfer_group`, Transfer com `source_transaction` — feature `spike-stripe-connect`

**Pronto quando:** usuário loga em produção e aparece na tabela `users`.

## Fase 1 — Catálogo
- [ ] Categorias (admin) e seed — feature `categorias` (em andamento)
- [ ] Candidatura de vendedor + aprovação admin + onboarding Connect — feature `vendedores`
- [ ] CRUD de produtos, variantes e upload de imagens — feature `produtos`
- [ ] PLP, PDP, página da loja com cache e revalidação — feature `vitrine`
- [ ] Busca FTS + facetas — feature `busca`
- [ ] Seed com 6 lojas e ~200 produtos — feature `vitrine`

**Pronto quando:** visitante navega e busca produtos reais de várias lojas.

## Fase 2 — Compra
- [ ] Carrinho visitante/logado + merge
- [ ] Endereços com ViaCEP; frete por loja
- [ ] Checkout com reserva de estoque, idempotência e Payment Element
- [ ] Webhooks Stripe, outbox + relay pg-boss, e-mails de pedido
- [ ] Expiração de reservas
- [ ] Teste de concorrência k6

**Pronto quando:** compra multi-loja paga com cartão de teste gera sub-pedidos e e-mails.

## Fase 3 — Pós-venda e dinheiro
- [ ] Despacho, confirmação de entrega (manual/automática), prazos
- [ ] Ledger, cálculo de comissão, job de repasse (Transfers)
- [ ] Painel financeiro do vendedor + Express Dashboard
- [ ] Cancelamentos, devoluções, reembolsos parciais, estorno de transferências
- [ ] Disputas

**Pronto quando:** o ciclo completo compra → entrega → repasse → devolução funciona e reconcilia com o Stripe.

## Entrega do portfólio (fecha o núcleo)
- [ ] Login de demonstração com 1 clique (comprador, vendedor e admin, com dados prontos) e cartão de teste visível no checkout
- [ ] E2E Playwright da jornada principal: compra multi-loja → despacho → entrega → repasse → devolução
- [ ] README com GIFs/vídeo, arquitetura, link da demo, credenciais de teste e "como rodar"
- [ ] Post técnico: "Como evitei overselling e dividi pagamentos entre vendedores"

**Pronto quando:** quem abre o link entra com 1 clique, completa uma compra multi-loja com cartão de teste e entende a arquitetura pelo README em poucos minutos.

---

**✂ Linha de corte** — daqui para baixo é bônus.

---

## Fase 4 (bônus) — Engajamento e operação
- [ ] Cupons (plataforma e loja)
- [ ] Avaliações e wishlist
- [ ] Painel admin completo (moderação, métricas, auditoria)
- [ ] Dashboard de métricas do vendedor
- [ ] LGPD (exportação/exclusão, banner de cookies)

## Fase 5 (bônus) — Polimento
- [ ] E2E Playwright das demais jornadas + axe
- [ ] Lighthouse CI com metas do PRD
- [ ] Sentry + OpenTelemetry + painel Grafana
- [ ] SEO (sitemap, JSON-LD, OG images)

## Definição de pronto (por funcionalidade)
- Critérios de aceite da spec atendidos, com prova: `onp-spec audit --ci` sai com código 0 (specs executáveis em `.spec/features/`)
- Testes unitários/integração dos casos de uso
- Endpoint documentado no OpenAPI e cliente regenerado
- Estados de loading, vazio e erro na UI; acessível por teclado
- Logs e erros observáveis
- CI verde
