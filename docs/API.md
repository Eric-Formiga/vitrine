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

Códigos de erro de domínio (campo `code`): `OUT_OF_STOCK`, `PRICE_CHANGED`, `COUPON_INVALID`, `COUPON_NOT_APPLICABLE`, `SELLER_NOT_ACTIVE` (403, a pessoa tem o papel seller mas a loja está suspensa), `INVALID_STATE_TRANSITION`, `RETURN_WINDOW_EXPIRED`, `IDEMPOTENCY_CONFLICT`, `FORBIDDEN_RESOURCE`, `VALIDATION_FAILED` (400, com `errors: [{ field, message }]`), `SLUG_TAKEN`, `INVALID_CATEGORY_PARENT`, `CATEGORY_NOT_FOUND`, `SELLER_APPLICATION_EXISTS` (409; quando a loja foi rejeitada há menos de 7 dias, traz `canReapplyAt`), `SELLER_APPLICATION_NOT_FOUND`, `SELLER_NOT_FOUND`, `SHIPPING_NOT_CONFIGURED`, `DOCUMENT_TAKEN` (409, uma loja por CPF/CNPJ), `PIX_KEY_NOT_FOUND` e `PIX_KEY_OWNER_MISMATCH` (422), `PIX_KEY_CHECK_UNAVAILABLE` (503, o Asaas não respondeu: tente depois), `PRODUCT_NOT_FOUND`, `PRODUCT_VERSION_CONFLICT` (412, outra escrita gravou antes; traz `currentVersion`), `PRECONDITION_REQUIRED` (428, falta o `If-Match`), `SKU_TAKEN` (409, outra variante ativa da loja usa o SKU; traz `sku`), `SIZE_GRID_MISMATCH` (422, a nova categoria tem outra grade de tamanhos e o produto tem variantes ativas; traz `sizeType`), `VARIANT_NOT_FOUND`, `STOCK_WOULD_BE_NEGATIVE` (422, o ajuste deixaria o estoque abaixo de zero ou do reservado; traz `currentStock`), `INVALID_IMAGE` (422, traz `position` e `reason`), `STORAGE_NOT_CONFIGURED` (503, faltam `SUPABASE_URL` e `SUPABASE_SECRET_KEY`), `STORAGE_UNAVAILABLE` (503, o Storage respondeu com erro; traz `providerStatus`), `PRODUCT_NOT_PUBLISHABLE` (422, falta algo para o produto estar à venda; traz `missing`: `images`, `stock` ou `variants`).

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
| GET / POST | `/seller/application` | 👤 | Candidatura e situação da própria loja (qualquer pessoa logada). O POST confere o titular da chave Pix no Asaas antes de gravar |
| GET / PATCH | `/seller/me` | 🏪 | Dados da loja |
| GET / PUT | `/seller/pix-key` | 🏪 | Chave Pix de recebimento; o PUT confere o titular no Asaas com os mesmos erros da candidatura (`PIX_KEY_NOT_FOUND`, `PIX_KEY_OWNER_MISMATCH`, `PIX_KEY_CHECK_UNAVAILABLE`); se falhar, a chave antiga continua. Auditado (`seller.pix_key_change`) |
| GET / PUT | `/seller/shipping` | 🏪 | Frete da loja: `originZip` (8 dígitos), `rates { N, NE, CO, SE, S }` em centavos, `freeShippingThresholdCents` (opcional, > 0), `handlingDays` (1 a 5). O PUT substitui tudo; o GET sem configuração responde 404 `SHIPPING_NOT_CONFIGURED` |
| GET / POST | `/seller/products` | 🏪 | Listar (`?status=`, do mais recente para o mais antigo, com capa, menor preço e estoque total) e criar o rascunho (slug do título, único na loja: `-2`, `-3`...). Categoria precisa ser ativa e sem subcategorias |
| GET / PATCH / DELETE | `/seller/products/{id}` | 🏪 | Detalhe, editar as informações e arquivar (não apaga, RN-17; arquivado é final). O GET e as escritas respondem `ETag: "<versão>"`; PATCH e DELETE exigem `If-Match` (desatualizado: 412 `PRODUCT_VERSION_CONFLICT` com `currentVersion`; ausente: 428 `PRECONDITION_REQUIRED`). Produto de outra loja: 404 `PRODUCT_NOT_FOUND` |
| POST | `/seller/products/{id}/publish` | 🏪 | Publicar, com `If-Match`: rascunho → ativo, com `publishedAt`. Exige pelo menos uma foto e uma variante ativa com estoque; senão 422 `PRODUCT_NOT_PUBLISHABLE` com `missing` (`images`, `stock`). Fora do rascunho: 422 `INVALID_STATE_TRANSITION`. O produto publicado (ativo ou suspenso) não fica sem foto nem sem grade: a troca que esvazia uma delas dá 422 `PRODUCT_NOT_PUBLISHABLE` (`images`, `variants`); estoque zero pode |
| GET / PUT | `/seller/products/{id}/variants` | 🏪 | Grade de variantes ativas, na ordem dos tamanhos, com o `ETag` do produto. O PUT manda a grade inteira (`{ variants: [...] }`, até 100) e exige `If-Match`. A chave é tamanho + cor (sem diferenciar maiúsculas na cor): quem continua mantém o id, quem sai é arquivada e quem volta é reativada. O PUT recalcula o menor preço. Tamanhos da grade do tipo da categoria (roupas PP a XGG, calçados 33 a 46, único U). SKU opcional, gerado como `SLUG-TAMANHO-COR`; repetido na loja dá 409 `SKU_TAKEN`. As fotos de uma cor que saiu passam a valer para todas |
| PATCH | `/seller/variants/{id}/stock` | 🏪 | Ajuste de estoque `{ delta }` ou `{ absolute }`, sem `If-Match` e sem mudar a versão do produto. Atômico no banco: ajustes simultâneos não se perdem. Abaixo de zero (ou do reservado): 422 `STOCK_WOULD_BE_NEGATIVE`. Responde `{ id, stock }` |
| GET / PUT | `/seller/products/{id}/images` | 🏪 | Fotos do produto, na ordem (a primeira é a capa), com a URL pública e o `ETag` do produto. O PUT manda a lista inteira (`{ images: [{ path, alt?, color? }] }`, de 0 a 8, sem repetir) e exige `If-Match`. Cada arquivo precisa ser da pasta da loja, ter sido pedido em `/seller/uploads` e estar no Storage com tipo e tamanho reais válidos; a cor, se vier, é de uma variante ativa. Problema num arquivo: 422 `INVALID_IMAGE` com `position` e `reason` (`outside-folder`, `not-uploaded`, `missing`, `type`, `size`, `color`). As que saíram vão para a limpeza |
| POST | `/seller/uploads` | 🏪 | URL assinada para o navegador enviar uma foto direto ao Storage (`PUT` com `Content-Type`). Entrada `{ contentType, sizeBytes }`: JPEG, PNG ou WebP de até 5 MB (senão 400, sem chamar o Storage). Responde 201 `{ path, uploadUrl, expiresAt }`: o arquivo vai para `sellers/{sellerId}/` com nome aleatório, e a URL vale o que o Storage define (2 h no Supabase). Sem o Supabase configurado: 503 `STORAGE_NOT_CONFIGURED` |
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
| GET | `/admin/sellers?status=` | 🛡️ | Lojas de uma situação (`status` obrigatório), da candidatura mais antiga para a mais nova, com o CPF/CNPJ completo, a conta dona e o titular da chave Pix |
| POST | `/admin/sellers/{id}/approve` · `/reject` · `/suspend` · `/reinstate` | 🛡️ | `PENDING → APPROVED \| REJECTED`, `APPROVED → SUSPENDED`, `SUSPENDED → APPROVED`; o resto é `INVALID_STATE_TRANSITION` (422). `reject` e `suspend` exigem `{ reason }`. Aprovar dá o papel `seller` na hora |
| PATCH | `/admin/sellers/{id}/commission` | 🛡️ | `{ commissionBps }` de 0 a 10000 (800 = 8%), ou `null` para a padrão; a resposta traz `effectiveCommissionBps` |
| GET / POST / PATCH / DELETE | `/admin/categories[/{id}]` | 🛡️ | Árvore com as arquivadas; DELETE arquiva em cascata (204) |
| POST | `/admin/categories/{id}/restore` | 🛡️ | Restaura só a categoria (exige a pai ativa) |
| POST | `/admin/products/{id}/suspend` · `/reinstate` | 🛡️ | Moderação: `ACTIVE → SUSPENDED` (exige `{ reason }`, mostrado ao vendedor) e `SUSPENDED → ACTIVE` (mantém o `publishedAt`); o resto é `INVALID_STATE_TRANSITION` (422). Sem `If-Match`, mas a versão do produto sobe. Auditado (`product.suspend`, `product.reinstate`), com o antes e o depois. Responde o produto com o `sellerId` |
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
| POST | `/webhooks/asaas` | 🔏 | Eventos do Asaas (pagamentos, checkout, transferências, chargebacks). Token no cabeçalho `asaas-access-token`, comparado em tempo constante: sem ele, ou sem `ASAAS_WEBHOOK_TOKEN` configurado, responde 401. Cada evento é processado uma vez pelo `id` (o reenvio responde 200 sem reprocessar), e o estado do objeto é buscado na API do Asaas, não lido do aviso |
| POST | `/webhooks/clerk` | 🔏 | Sincronização de usuários (Svix) |
| GET | `/health/live` · `/health/ready` | 🌐 | Health checks |
