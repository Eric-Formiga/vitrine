# API — Vitrine

Documentação interativa gerada automaticamente em `/docs` (Swagger UI) a partir do OpenAPI. Este arquivo define convenções e o catálogo de endpoints.

## 1. Convenções

| Tema | Convenção |
|---|---|
| Base | `https://api.<dominio>/v1` — versão no path |
| Formato | JSON, `camelCase`; datas ISO 8601 UTC; dinheiro `{ amountCents: number }` em BRL |
| Auth | `Authorization: Bearer <Clerk session JWT>`; rotas públicas marcadas com `@Public()` |
| Paginação | cursor: `?limit=24&cursor=<opaque>` → `{ data, nextCursor }`. Admin pode usar `page`/`pageSize` |
| Filtros | query string; listas separadas por vírgula (`size=P,M`) |
| Erros | `application/problem+json` (RFC 9457): `{ type, title, status, detail, code, errors? }` |
| Idempotência | `Idempotency-Key` obrigatório em `POST /checkout` e endpoints que movimentam dinheiro |
| Concorrência | `ETag`/`If-Match` em edição de produto (evitar sobrescrita) |
| Rate limit | headers `RateLimit-*`; 429 com `Retry-After` |

Códigos de erro de domínio (campo `code`): `OUT_OF_STOCK`, `PRICE_CHANGED`, `COUPON_INVALID`, `COUPON_NOT_APPLICABLE`, `SELLER_NOT_ACTIVE`, `INVALID_STATE_TRANSITION`, `RETURN_WINDOW_EXPIRED`, `IDEMPOTENCY_CONFLICT`, `FORBIDDEN_RESOURCE`, `VALIDATION_FAILED` (400, com `errors: [{ field, message }]`), `SLUG_TAKEN`, `INVALID_CATEGORY_PARENT`, `CATEGORY_NOT_FOUND`.

Rotas `/admin/*` respondem 404 (e não 403) para quem não é admin, e toda escrita bem-sucedida grava `audit_logs`.

## 2. Endpoints

Legenda de acesso: 🌐 público · 👤 autenticado · 🏪 vendedor · 🛡️ admin · 🔏 assinatura de webhook

### Catálogo e lojas
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/categories` | 🌐 | Árvore de categorias |
| GET | `/products` | 🌐 | Lista/busca: `q, category, size, color, priceMin, priceMax, seller, condition, sort(relevance\|newest\|price_asc\|price_desc\|best_selling), cursor` → inclui `facets` |
| GET | `/products/{slug}` | 🌐 | Detalhe com variantes e imagens |
| GET | `/products/{id}/availability` | 🌐 | Estoque disponível por variante (não cacheado) |
| GET | `/products/{id}/reviews` | 🌐 | Avaliações paginadas + distribuição |
| GET | `/stores/{slug}` | 🌐 | Perfil público da loja |
| GET | `/stores/{slug}/products` | 🌐 | Produtos da loja |

### Carrinho e frete
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/cart` | 🌐/👤 | Carrinho agrupado por loja, revalidado (cookie `cart_token` para visitante) |
| POST | `/cart/items` | 🌐/👤 | `{ variantId, quantity }` |
| PATCH | `/cart/items/{id}` | 🌐/👤 | Altera quantidade |
| DELETE | `/cart/items/{id}` | 🌐/👤 | Remove item |
| POST | `/cart/merge` | 👤 | Mescla carrinho do visitante ao logar |
| POST | `/cart/coupons` | 👤 | Aplica cupom `{ code }` |
| DELETE | `/cart/coupons/{code}` | 👤 | Remove cupom |
| POST | `/shipping/quote` | 🌐/👤 | `{ zipCode }` → frete por loja |

### Checkout
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/checkout` | 👤 | `{ addressId }` + `Idempotency-Key` → `{ orderId, clientSecret, expiresAt }` |
| GET | `/checkout/{orderId}/status` | 👤 | Status do pagamento (polling) |

### Minha conta
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET / PATCH | `/me` | 👤 | Perfil |
| GET / POST | `/me/addresses` | 👤 | Endereços |
| PATCH / DELETE | `/me/addresses/{id}` | 👤 | |
| GET | `/me/orders` | 👤 | Meus pedidos |
| GET | `/me/orders/{id}` | 👤 | Detalhe com sub-pedidos e rastreios |
| POST | `/me/seller-orders/{id}/confirm-delivery` | 👤 | Confirma recebimento |
| POST | `/me/seller-orders/{id}/cancel` | 👤 | Cancela se prazo de despacho estourou (RN-8) |
| POST | `/me/seller-orders/{id}/returns` | 👤 | Solicita devolução |
| POST | `/me/returns/{id}/shipped` | 👤 | Informa rastreio do envio de volta |
| POST | `/me/returns/{id}/escalate` | 👤 | Escala devolução rejeitada ao admin |
| GET / POST / DELETE | `/me/wishlist[/{productId}]` | 👤 | Wishlist |
| POST | `/order-items/{id}/review` | 👤 | Avalia item entregue |
| POST | `/me/data-export` | 👤 | Gera exportação LGPD (enviada por e-mail) |
| DELETE | `/me` | 👤 | Exclui conta (anonimiza dados com histórico financeiro) |

### Vendedor
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/seller/application` | 👤 | Candidatura |
| GET / PATCH | `/seller/me` | 🏪 | Dados da loja |
| GET / PUT | `/seller/pix-key` | 🏪 | Chave Pix de recebimento; o PUT confere o titular no Asaas (`PIX_KEY_NOT_FOUND`, `PIX_KEY_OWNER_MISMATCH`) |
| PUT | `/seller/shipping` | 🏪 | Configuração de frete |
| GET / POST | `/seller/products` | 🏪 | Listar/criar |
| GET / PATCH / DELETE | `/seller/products/{id}` | 🏪 | Detalhe/editar/arquivar |
| POST | `/seller/products/{id}/publish` | 🏪 | Publicar |
| PUT | `/seller/products/{id}/variants` | 🏪 | Substitui conjunto de variantes |
| PATCH | `/seller/variants/{id}/stock` | 🏪 | Ajuste de estoque `{ delta \| absolute }` |
| POST | `/seller/uploads` | 🏪 | URL assinada de upload |
| GET | `/seller/orders` | 🏪 | Sub-pedidos (filtro por status) |
| GET | `/seller/orders/{id}` | 🏪 | Detalhe |
| POST | `/seller/orders/{id}/ship` | 🏪 | `{ carrier, trackingCode }` |
| POST | `/seller/orders/{id}/cancel` | 🏪 | Cancela antes do despacho |
| GET | `/seller/returns` | 🏪 | Devoluções |
| POST | `/seller/returns/{id}/approve` · `/reject` · `/received` | 🏪 | Fluxo de devolução |
| GET / POST / PATCH | `/seller/coupons[/{id}]` | 🏪 | Cupons da loja |
| GET | `/seller/finance/summary` | 🏪 | A liberar, liberado, estornado |
| GET | `/seller/finance/ledger` | 🏪 | Extrato |
| GET | `/seller/metrics` | 🏪 | Métricas do dashboard `?from&to` |

### Admin
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/admin/sellers` | 🛡️ | Lista com filtro por status |
| POST | `/admin/sellers/{id}/approve` · `/reject` · `/suspend` · `/reinstate` | 🛡️ | |
| PATCH | `/admin/sellers/{id}/commission` | 🛡️ | Comissão customizada |
| GET / POST / PATCH / DELETE | `/admin/categories[/{id}]` | 🛡️ | Árvore com as arquivadas; DELETE arquiva em cascata (204) |
| POST | `/admin/categories/{id}/restore` | 🛡️ | Restaura só a categoria (exige a pai ativa) |
| POST | `/admin/products/{id}/suspend` · `/reinstate` | 🛡️ | Moderação |
| POST | `/admin/reviews/{id}/hide` · `/restore` | 🛡️ | |
| GET | `/admin/orders[/{id}]` | 🛡️ | Todos os pedidos |
| POST | `/admin/seller-orders/{id}/refund` | 🛡️ | Reembolso manual `{ amountCents, reason }` |
| GET | `/admin/returns?status=ESCALATED` | 🛡️ | Devoluções escaladas |
| POST | `/admin/returns/{id}/resolve` | 🛡️ | Decide a favor de comprador/vendedor |
| GET | `/admin/chargebacks` | 🛡️ | Chargebacks (contestações de cartão) |
| GET / POST / PATCH | `/admin/coupons[/{id}]` | 🛡️ | Cupons de plataforma |
| GET / PATCH | `/admin/settings` | 🛡️ | Comissão padrão, prazos |
| GET | `/admin/metrics` | 🛡️ | GMV, receita, pedidos, lojas |
| GET | `/admin/audit-logs` | 🛡️ | Auditoria |

### Webhooks e operação
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/webhooks/asaas` | 🔏 | Eventos do Asaas (pagamentos, checkout, transferências, chargebacks); token no cabeçalho `asaas-access-token` |
| POST | `/webhooks/clerk` | 🔏 | Sincronização de usuários (Svix) |
| GET | `/health/live` · `/health/ready` | 🌐 | Health checks |
