# PRD — Vitrine

| Campo | Valor |
|---|---|
| Produto | Vitrine — marketplace multi-vendedor de moda |
| Autor | Eric |
| Status | Rascunho v1 |
| Última atualização | 2026-10-19 |

---

## 1. Visão geral

### 1.1 Problema
Pequenas marcas autorais e brechós de moda vendem principalmente por Instagram e WhatsApp: catálogo desorganizado, pagamento manual (Pix com comprovante), sem controle de estoque e sem garantia para o comprador. Montar loja própria custa caro e não traz tráfego.

### 1.2 Solução
Um marketplace onde vendedores independentes de moda abrem sua loja em minutos, cadastram produtos com variações (tamanho/cor), recebem pagamentos com repasse automático e a plataforma retém uma comissão. O comprador navega num catálogo único, monta um carrinho com itens de várias lojas e paga uma única vez.

### 1.3 Objetivo do projeto (portfólio)
Demonstrar, num sistema realista e publicado, competência em:
- **Pagamentos distribuídos**: um pagamento → vários repasses, comissões, reembolsos parciais, estornos de repasse, disputas.
- **Consistência e concorrência**: reserva de estoque sem *overselling*, idempotência, webhooks, outbox.
- **Arquitetura**: monólito modular em camadas, contratos tipados ponta a ponta, eventos de domínio.
- **Qualidade**: testes em múltiplos níveis, CI/CD, observabilidade, acessibilidade, performance.

## 2. Métricas de sucesso

Como é um projeto de portfólio, as métricas medem **qualidade de engenharia e completude**, não receita.

| Métrica | Meta |
|---|---|
| Fluxo completo demonstrável em produção (modo teste Stripe) | compra multi-vendedor → repasse → devolução |
| Lighthouse (home, PLP, PDP) | Performance ≥ 90, Acessibilidade ≥ 95, SEO ≥ 95 |
| Cobertura de testes nas camadas de domínio/aplicação | ≥ 80% |
| Teste de concorrência de estoque (k6) | 0 casos de overselling em 200 compras simultâneas do último item |
| Pipeline de CI | < 10 min, verde na `main` |
| Documentação | README com demo, credenciais de teste, diagramas e ADRs |

## 3. Personas

**Ana — Compradora (28, São Paulo)**: compra roupa pelo celular, valoriza marcas pequenas, quer frete claro, Pix/cartão e poder devolver se não servir.

**Lucas — Vendedor (34, dono de marca autoral)**: vende ~80 peças/mês pelo Instagram. Quer cadastrar produtos rápido, saber o que despachar e quando recebe.

**Marina — Operadora da plataforma (admin)**: aprova lojas, modera conteúdo, resolve disputas e acompanha métricas.

## 4. Escopo

### 4.1 MVP (v1) — dentro do escopo
- Autenticação (Clerk) com papéis comprador, vendedor e admin
- Candidatura de vendedor, aprovação pelo admin e onboarding Stripe Connect Express
- Catálogo com categorias hierárquicas, produtos com variantes (tamanho × cor), imagens, guia de medidas
- Busca textual em português com filtros facetados e ordenação
- Carrinho multi-vendedor (visitante e logado, com merge)
- Frete por vendedor via tabela configurável (fixo por região + grátis acima de valor)
- Checkout único com Stripe Payment Element (cartão; Pix se disponível na conta)
- Pedido dividido em sub-pedidos por vendedor; fluxo de despacho com código de rastreio
- Repasse automático ao vendedor após janela de arrependimento, com comissão da plataforma
- Devoluções e reembolsos parciais; tratamento de disputas (chargebacks)
- Cupons da plataforma e do vendedor
- Avaliações de compra verificada; wishlist
- E-mails transacionais
- Painel do vendedor (produtos, pedidos, financeiro, métricas)
- Painel admin (lojas, moderação, categorias, comissão, disputas, métricas, auditoria)
- LGPD: exportação e exclusão de dados

### 4.2 v2 — planejado, fora do MVP
- Cotação de frete real (Melhor Envio) e rastreio automático
- Equipes de vendedor (Clerk Organizations)
- Chat comprador ↔ vendedor
- Busca com Meilisearch e recomendações
- Notificações push/in-app em tempo real
- Parcelamento, programa de fidelidade

### 4.3 Fora de escopo
- App mobile nativo
- Emissão de nota fiscal
- Multi-moeda e internacionalização (apenas BRL e pt-BR)
- Logística própria

## 5. Requisitos funcionais

Detalhamento, critérios de aceite e regras em [specs/](specs/).

### 5.1 Identidade e acesso (`AUTH`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-AUTH-1 | Cadastro/login com e-mail+senha, Google e magic link (Clerk) | M |
| RF-AUTH-2 | Sincronização de usuários Clerk → banco via webhook | M |
| RF-AUTH-3 | Papéis `customer`, `seller`, `admin`; autorização validada no backend | M |
| RF-AUTH-4 | Perfil do usuário e catálogo de endereços (com autocompletar via CEP) | M |
| RF-AUTH-5 | Exportar meus dados e excluir minha conta (LGPD) | S |

### 5.2 Vendedores (`SELLER`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-SELLER-1 | Candidatura para vender (dados da loja, documento, categoria principal) | M |
| RF-SELLER-2 | Aprovação/rejeição/suspensão pelo admin | M |
| RF-SELLER-3 | Onboarding Stripe Connect Express e acompanhamento de status | M |
| RF-SELLER-4 | Página pública da loja (logo, banner, bio, avaliação média, produtos) | M |
| RF-SELLER-5 | Configuração de frete da loja | M |
| RF-SELLER-6 | Dashboard com vendas, ticket médio, produtos mais vendidos | S |

### 5.3 Catálogo e busca (`CAT`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-CAT-1 | CRUD de produtos pelo vendedor, com rascunho/publicado/arquivado | M |
| RF-CAT-2 | Variantes por tamanho × cor com SKU, preço, preço "de", estoque | M |
| RF-CAT-3 | Upload de até 8 imagens por produto, ordenáveis, com imagem por cor | M |
| RF-CAT-4 | Categorias hierárquicas geridas pelo admin | M |
| RF-CAT-5 | Listagem com filtros (categoria, tamanho, cor, faixa de preço, loja, condição novo/usado) e ordenação | M |
| RF-CAT-6 | Busca textual tolerante a acentos e erros de digitação | M |
| RF-CAT-7 | Página de produto com seleção de variante, disponibilidade, guia de medidas, avaliações | M |
| RF-CAT-8 | SEO: URLs amigáveis, metadados, sitemap, dados estruturados `Product` | S |

### 5.4 Carrinho e checkout (`CART`, `CHK`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-CART-1 | Carrinho para visitante (cookie) e logado; merge ao autenticar | M |
| RF-CART-2 | Itens agrupados por loja, com subtotal e frete por loja | M |
| RF-CART-3 | Revalidação de preço e estoque a cada leitura do carrinho | M |
| RF-CHK-1 | Checkout exige login, endereço e seleção de frete | M |
| RF-CHK-2 | Aplicação de até 1 cupom da plataforma + 1 cupom por loja | S |
| RF-CHK-3 | Reserva de estoque por 15 min durante pagamento | M |
| RF-CHK-4 | Pagamento único via Stripe Payment Element | M |
| RF-CHK-5 | Página de confirmação com status em tempo real (polling) | M |

### 5.5 Pagamentos e repasses (`PAY`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-PAY-1 | Processar webhooks Stripe de forma idempotente | M |
| RF-PAY-2 | Calcular comissão por sub-pedido e registrar ledger de valores | M |
| RF-PAY-3 | Repasse automático (Transfer) ao vendedor após liberação | M |
| RF-PAY-4 | Painel financeiro do vendedor (a liberar, liberado, estornado) e link ao Express Dashboard | M |

### 5.6 Pedidos e entrega (`ORD`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-ORD-1 | Pedido com sub-pedidos por loja e snapshot de itens/preços | M |
| RF-ORD-2 | Vendedor marca despacho com código de rastreio | M |
| RF-ORD-3 | Comprador confirma recebimento; confirmação automática após prazo | M |
| RF-ORD-4 | Cancelamento pelo vendedor antes do despacho (com reembolso) | M |
| RF-ORD-5 | Histórico e detalhe de pedidos para comprador, vendedor e admin | M |

### 5.7 Devoluções e disputas (`RET`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-RET-1 | Solicitação de devolução até 7 dias após entrega | M |
| RF-RET-2 | Fluxo de aprovação, recebimento e reembolso parcial | M |
| RF-RET-3 | Tratamento de disputas Stripe (bloqueio/estorno de repasse) | S |

### 5.8 Engajamento (`ENG`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-ENG-1 | Avaliação (1–5 + texto + fotos) apenas de compra entregue | S |
| RF-ENG-2 | Wishlist | S |
| RF-ENG-3 | Cupons percentuais/fixos com regras de validade, mínimo e limite de uso | S |
| RF-ENG-4 | E-mails transacionais (pedido, pagamento, despacho, devolução, repasse) | M |

### 5.9 Administração (`ADM`)
| ID | Requisito | Prioridade |
|---|---|---|
| RF-ADM-1 | Gestão de lojas (aprovar, suspender, comissão customizada) | M |
| RF-ADM-2 | Moderação de produtos e avaliações | S |
| RF-ADM-3 | Visão de todos os pedidos, reembolso manual | M |
| RF-ADM-4 | Métricas da plataforma (GMV, receita de comissão, pedidos, lojas ativas) | S |
| RF-ADM-5 | Log de auditoria de ações sensíveis | S |

## 6. Requisitos não funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-1 | Performance | API: p95 < 200 ms em leituras e < 800 ms no `POST /checkout` (excluindo latência de rede) |
| RNF-2 | Performance | Web: LCP < 2,5 s e CLS < 0,1 em PDP/PLP (4G simulado); Lighthouse conforme seção 2 |
| RNF-3 | Escalabilidade | Estado persistente só no Postgres. A demo roda em instância única (cache/rate limit em memória); escala horizontal exige trocar esses adapters por Redis, sem mudar casos de uso |
| RNF-18 | Custo | Infraestrutura da demo ≤ US$ 5/mês (ver [ARCHITECTURE.md §10](ARCHITECTURE.md#10-ambientes-e-deploy)) |
| RNF-4 | Consistência | Nenhum overselling sob concorrência; toda mutação de estoque é atômica |
| RNF-5 | Confiabilidade | Webhooks e jobs idempotentes; reprocessamento seguro; outbox garante entrega *at-least-once* |
| RNF-6 | Segurança | Nenhum dado de cartão trafega ou é armazenado pela plataforma (PCI SAQ A via Stripe Elements) |
| RNF-7 | Segurança | OWASP Top 10: validação de entrada, autorização por recurso, rate limiting, headers (helmet/CSP), CORS restrito, segredos fora do código |
| RNF-8 | Segurança | Assinatura verificada em todos os webhooks (Stripe, Stripe Connect, Clerk) |
| RNF-9 | Privacidade | LGPD: consentimento de cookies, exportação/exclusão de dados, minimização de PII em logs |
| RNF-10 | Acessibilidade | WCAG 2.1 AA; navegação por teclado no fluxo de compra completo |
| RNF-11 | Disponibilidade | Meta 99,5% (limitada por planos gratuitos/baratos); health checks `live`/`ready` |
| RNF-12 | Observabilidade | Logs estruturados com `requestId`/`orderId`; erros no Sentry; métricas e traces (OpenTelemetry) |
| RNF-13 | Manutenibilidade | TypeScript strict, lint, formatação, contratos tipados web↔api, ADRs para decisões |
| RNF-14 | Testabilidade | Unit, integração (Testcontainers), E2E (Playwright), carga (k6); CI bloqueia merge se falhar |
| RNF-15 | Responsividade | Mobile-first; suportar 360 px a 1920 px |
| RNF-16 | Dados | Valores monetários em centavos (inteiro); datas em UTC, exibidas em `America/Sao_Paulo` |
| RNF-17 | Portabilidade | Ambiente local completo com `docker compose up` + `pnpm dev` |

## 7. Regras de negócio

| ID | Regra |
|---|---|
| RN-1 | Moeda única BRL. Preços armazenados em centavos. |
| RN-2 | Apenas lojas `APPROVED` e com Stripe `charges_enabled` e `payouts_enabled` podem publicar produtos. |
| RN-3 | Comissão padrão da plataforma: 12% sobre (subtotal de itens − desconto do vendedor). Frete não é comissionado. Admin pode definir comissão por loja. |
| RN-4 | A plataforma absorve as taxas do Stripe (cobertas pela comissão). |
| RN-5 | Um pedido é pago numa única cobrança; cada loja gera um sub-pedido independente com status próprio. |
| RN-6 | Estoque é reservado ao iniciar o checkout por 15 min; expirado sem pagamento, a reserva é liberada e o PaymentIntent cancelado. |
| RN-7 | Preço, nome e imagem do item são congelados (snapshot) no pedido. |
| RN-8 | Vendedor tem 3 dias úteis após pagamento para despachar; senão o sub-pedido pode ser cancelado pelo comprador com reembolso. |
| RN-9 | Entrega é confirmada pelo comprador ou automaticamente 15 dias após o despacho. |
| RN-10 | Direito de arrependimento (CDC art. 49): devolução pode ser solicitada até 7 dias após a entrega. |
| RN-11 | Repasse ao vendedor é liberado 7 dias após a entrega sem devolução aberta. Devolução aberta suspende o repasse até resolução. |
| RN-12 | Cupom da plataforma é custeado pela plataforma (não reduz o repasse); cupom de loja é custeado pela loja (reduz a base do repasse). |
| RN-13 | Máximo 1 cupom de plataforma + 1 cupom por loja por pedido. |
| RN-14 | Avaliação só é permitida para item de sub-pedido `DELIVERED`/`COMPLETED`, uma por item comprado. |
| RN-15 | Disputa aberta antes do repasse bloqueia o repasse; disputa perdida após o repasse gera estorno de transferência (*transfer reversal*). |
| RN-16 | Vendedor não pode comprar os próprios produtos. |
| RN-17 | Produto com pedidos não é excluído fisicamente, apenas arquivado. |

## 8. Premissas, restrições e riscos

**Premissas**
- Stripe operando em **modo teste**; contas conectadas de teste para os vendedores da demo.
- Dados de seed realistas (lojas, produtos, imagens livres de direitos).

**Restrições**
- Orçamento de infraestrutura ≈ US$ 0–10/mês (planos gratuitos/hobby).
- Desenvolvimento solo.

**Riscos**
| Risco | Impacto | Mitigação |
|---|---|---|
| Disponibilidade de Stripe Connect/Pix para conta brasileira em produção | Médio | Projeto roda em modo teste; documentar o que mudaria em produção. Validar no início (spike). |
| Complexidade de repasses/reembolsos | Alto | Ledger explícito, máquina de estados, testes de integração com Stripe mockado + testes manuais com Stripe CLI |
| Cold start em planos gratuitos | Baixo | Plano hobby pago na API; health check externo |
| Escopo grande para dev solo | Alto | Roadmap em fases com MVP navegável cedo; itens `S`/`C` cortáveis |

## 9. Glossário

| Termo | Definição |
|---|---|
| Pedido (Order) | Compra do comprador; contém um pagamento e N sub-pedidos |
| Sub-pedido (SellerOrder) | Parte do pedido pertencente a uma loja; unidade de despacho, devolução e repasse |
| Repasse (Payout/Transfer) | Transferência Stripe da plataforma para a conta conectada da loja |
| Conta conectada | Conta Stripe Express do vendedor |
| Reserva | Bloqueio temporário de estoque durante o pagamento |
| GMV | Valor bruto total transacionado |
| PLP / PDP | Página de listagem / página de produto |
