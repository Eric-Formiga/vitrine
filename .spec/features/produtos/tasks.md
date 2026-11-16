# Tasks: Produtos — cadastro com variantes, imagens, estoque e moderação

> feature: produtos

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

## T-020 — Produtos no banco: criar, editar, listar e arquivar, com versão [pendente]
- Refs: US-023, AC-060, AC-061, AC-062, US-027, AC-074, AC-075, AC-076
- Arquivos: apps/api/prisma/schema.prisma, apps/api/prisma/migrations, apps/api/src/shared/http/if-match.ts, apps/api/src/shared/http/if-match.spec.ts, apps/api/src/modules/sellers/sellers.module.ts, apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/domain/product.ts, apps/api/src/modules/catalog/domain/product.spec.ts, apps/api/src/modules/catalog/domain/product-errors.ts, apps/api/src/modules/catalog/application/category.repository.ts, apps/api/src/modules/catalog/infra/prisma-category.repository.ts, apps/api/src/modules/catalog/application/product.repository.ts, apps/api/src/modules/catalog/application/create-product.use-case.ts, apps/api/src/modules/catalog/application/update-product.use-case.ts, apps/api/src/modules/catalog/application/archive-product.use-case.ts, apps/api/src/modules/catalog/application/list-my-products.use-case.ts, apps/api/src/modules/catalog/infra/prisma-product.repository.ts, apps/api/src/modules/catalog/http/product.dto.ts, apps/api/src/modules/catalog/http/seller-products.controller.ts, apps/api/test/support/product-test-kit.ts, apps/api/test/seller-products.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md, docs/DATA_MODEL.md
- Notas:
  - **Primeira tarefa.** O schema entra inteiro aqui, para as tarefas seguintes não disputarem o `schema.prisma`:
    - `products`: DATA_MODEL, mais `version` (inteiro, começa em 1), `suspension_reason` e `suspended_at`. `search_vector`, `sold_count` e as notas ficam para `busca` e `vitrine`.
    - `product_variants`: com `seller_id` copiado da loja, para o SKU único por loja.
    - `product_images`: com `path` no lugar de `url`; a URL pública sai do `path`.
    - `uploads`: `path` (PK), `seller_id`, `content_type`, `size_bytes`, `created_at` e `detached_at`.
  - Restrições na migração, em SQL:
    - `CHECK (stock >= 0 AND reserved >= 0 AND reserved <= stock)` e `UNIQUE(product_id, size, color)`;
    - índice único parcial `(seller_id, sku) WHERE archived_at IS NULL`;
    - `UNIQUE(product_id, position)` nas imagens;
    - slug único por loja `(seller_id, slug)`.
  - Rotas em `/v1/seller/products` com `@Roles('seller')` e o `ApprovedSellerGuard`, que o `sellers` passa a exportar com o que ele precisa.
  - Categoria "folha": ativa e sem filhas ativas (ASM-023). O repositório de categorias ganha a consulta.
  - Slug: `slugify` do `shared/text`, com sufixo `-2`, `-3`... quando repetir na loja. Vem do índice único com nova tentativa, como em `categorias`.
  - Versão (ASM-026): `ETag: "n"` nas respostas.
    - Toda escrita do vendedor exige `If-Match` (helper em `shared/http/if-match.ts`).
    - O `UPDATE ... WHERE id = $1 AND version = $2` incrementa a versão. Zero linhas atualizadas viram 412 `PRODUCT_VERSION_CONFLICT`, com a versão atual. Sem o cabeçalho: 428 `PRECONDITION_REQUIRED`.
    - A T-021 e a T-022 usam o mesmo mecanismo. A criação não exige `If-Match`.
  - Arquivar é `DELETE` e muda a situação para `ARCHIVED` (RN-17, ASM-030). Arquivado é final: `INVALID_STATE_TRANSITION` (422), com o erro que o `sellers` já tem movido para o `shared`, se for preciso.
  - Lista: capa, menor preço (`min_price_cents`) e estoque total (soma das variantes ativas). Filtro `status` opcional; do mais recente para o mais antigo.
  - Regenerar o contrato (`pnpm api:generate`).

## T-021 — Grade de variantes e ajuste rápido de estoque [pendente]
- Refs: US-024, AC-063, AC-064, AC-065, AC-066, US-028, AC-077, AC-078
- Arquivos: apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/domain/size-grid.ts, apps/api/src/modules/catalog/domain/variant.ts, apps/api/src/modules/catalog/domain/variant.spec.ts, apps/api/src/modules/catalog/application/variant.repository.ts, apps/api/src/modules/catalog/application/replace-variants.use-case.ts, apps/api/src/modules/catalog/application/adjust-stock.use-case.ts, apps/api/src/modules/catalog/infra/prisma-variant.repository.ts, apps/api/src/modules/catalog/http/variant.dto.ts, apps/api/src/modules/catalog/http/seller-variants.controller.ts, apps/api/test/support/product-test-kit.ts, apps/api/test/seller-variants.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md
- Notas:
  - **Depende da T-020.**
  - Grade de tamanhos por `sizeType`, em `size-grid.ts`: `CLOTHING` = PP, P, M, G, GG, XGG; `SHOES` = 33 a 46; `ONE_SIZE` = U.
  - As regras de cada variante ficam no domínio (`variant.ts`), e o erro aponta o índice (`variants.2.priceCents`):
    - preço > 0 e até R$ 100.000;
    - preço "de" maior que o preço;
    - estoque de 0 a 99.999;
    - peso de 1 a 30.000 g;
    - `colorHex` no formato `#RRGGBB`;
    - nome da cor de 1 a 30 caracteres;
    - combinação de tamanho e cor sem repetir.
  - SKU gerado quando omitido: `SLUG-TAMANHO-COR`, em maiúsculas e sem acentos (ASM-024). Conflito no índice parcial: 409 `SKU_TAKEN`, com o SKU.
  - Trocar a grade (AC-066), numa transação com a versão do produto (`If-Match`):
    - a chave é `(size, color)`;
    - quem continua é atualizado no lugar;
    - quem sai ganha `archived_at`;
    - quem volta perde o `archived_at`;
    - o `min_price_cents` é recalculado.
  - As imagens de uma cor que saiu passam a valer para todas (ASM-027). Isso só tem efeito depois da T-022; aqui, a consulta já zera `color` em `product_images`.
  - Ajuste de estoque (`PATCH /v1/seller/variants/{id}/stock`), sem `If-Match`:
    - `delta` ou `absolute`, um dos dois;
    - um único `UPDATE ... SET stock = stock + $delta WHERE id = $1 AND seller_id = $2 AND stock + $delta >= reserved RETURNING stock`, atômico no banco, sem ler antes;
    - zero linhas: 404 se a variante não é da loja, 422 `STOCK_WOULD_BE_NEGATIVE` se é;
    - não muda a versão do produto.
  - AC-078 roda os 10 ajustes com `Promise.all`.

## T-022 — Imagens: Supabase Storage, URL de upload e imagens do produto [pendente]
- Refs: US-025, AC-067, AC-068, AC-069, AC-070
- Arquivos: .env.example, apps/api/vitest.config.ts, apps/api/src/shared/config/env.ts, apps/api/src/shared/config/env.spec.ts, apps/api/src/app.module.ts, apps/api/src/create-app.ts, apps/api/src/modules/media/media.module.ts, apps/api/src/modules/media/domain/upload.ts, apps/api/src/modules/media/domain/upload.spec.ts, apps/api/src/modules/media/application/storage-gateway.port.ts, apps/api/src/modules/media/application/upload.repository.ts, apps/api/src/modules/media/application/request-upload.use-case.ts, apps/api/src/modules/media/infra/supabase-storage.gateway.ts, apps/api/src/modules/media/infra/prisma-upload.repository.ts, apps/api/src/modules/media/http/upload.dto.ts, apps/api/src/modules/media/http/seller-uploads.controller.ts, apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/application/product-image.repository.ts, apps/api/src/modules/catalog/application/replace-images.use-case.ts, apps/api/src/modules/catalog/infra/prisma-product-image.repository.ts, apps/api/src/modules/catalog/http/product-image.dto.ts, apps/api/src/modules/catalog/http/seller-product-images.controller.ts, apps/api/test/support/storage-test-kit.ts, apps/api/test/support/supabase-sandbox.ts, apps/api/test/support/http-cassette.ts, apps/api/test/fixtures/supabase, apps/api/test/support/product-test-kit.ts, apps/api/test/seller-product-images.e2e-spec.ts, apps/api/test/supabase-storage.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md
- Notas:
  - **Depende da T-020.** Módulo `media` (ARCHITECTURE) com a porta `StorageGateway`:
    - `createSignedUpload(path)` devolve `{ uploadUrl, expiresAt }`;
    - `stat(path)` devolve `{ contentType, sizeBytes }` ou `null`;
    - `remove(paths)`;
    - `publicUrl(path)`.
  - Adaptador com `fetch` puro na API REST do Storage, sem SDK, para caber no cassete:
    - `POST /storage/v1/object/upload/sign/{bucket}/{path}`;
    - `HEAD` no objeto, ou `GET /storage/v1/object/info/...`;
    - `DELETE /storage/v1/object/{bucket}`.
  - Variáveis novas:
    - `SUPABASE_URL` e `SUPABASE_SECRET_KEY`, opcionais. Sem elas, o adaptador responde 503 `STORAGE_NOT_CONFIGURED`, como o Asaas sem chave;
    - `SUPABASE_STORAGE_BUCKET`, padrão `product-images`.
  - O `createApp` aceita `storageGateway`, como aceita o `paymentGateway`. Os testes usam o Storage falso do `storage-test-kit.ts`, em memória, que simula o upload.
  - URL de upload (`POST /v1/seller/uploads`):
    - tipo e tamanho validados no domínio (`upload.ts`): jpeg, png ou webp, até 5 MB;
    - caminho `sellers/{sellerId}/{uuid}.{ext}`;
    - registra o upload em `uploads`.
  - Imagens do produto (`PUT /v1/seller/products/{id}/images`, com `If-Match`):
    - 0 a 8 itens no formato. O mínimo de 1 vale só para publicar, AC-071 e AC-073;
    - cada caminho tem que estar na pasta da loja e existir em `uploads`; o `stat` no Storage confere o tipo e o tamanho reais;
    - a cor tem que existir entre as variantes ativas;
    - 422 `INVALID_IMAGE`, com `position` e `reason`.
  - Na troca, os caminhos que saíram ganham `detached_at` em `uploads`, e os que entraram perdem.
  - AC-070 segue o kit do Asaas:
    - `SUPABASE_RECORD=1` fala com o projeto real e grava em `test/fixtures/supabase/`;
    - sem a variável, reproduz o cassete;
    - o `http-cassette.ts` passa a esconder também a URL assinada (o token) e o cabeçalho `authorization`.
  - **Bloqueio:** gravar o cassete exige o projeto Supabase do dono, com o bucket público `product-images` (5 MB; jpeg/png/webp).

## T-023 — Publicar, manter o produto ativo completo e moderação do admin [pendente]
- Refs: US-026, AC-071, AC-072, AC-073, US-029, AC-079, AC-080
- Arquivos: apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/domain/product.ts, apps/api/src/modules/catalog/domain/product.spec.ts, apps/api/src/modules/catalog/domain/product-errors.ts, apps/api/src/modules/catalog/application/product.repository.ts, apps/api/src/modules/catalog/application/publish-product.use-case.ts, apps/api/src/modules/catalog/application/moderate-product.use-case.ts, apps/api/src/modules/catalog/application/replace-variants.use-case.ts, apps/api/src/modules/catalog/application/replace-images.use-case.ts, apps/api/src/modules/catalog/infra/prisma-product.repository.ts, apps/api/src/modules/catalog/http/product.dto.ts, apps/api/src/modules/catalog/http/seller-products.controller.ts, apps/api/src/modules/catalog/http/admin-products.controller.ts, apps/api/test/support/product-test-kit.ts, apps/api/test/product-publishing.e2e-spec.ts, apps/api/test/admin-products.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md
- Notas:
  - **Depende da T-021 e da T-022.**
  - Uma regra pura no domínio, `publishIssues(product)`, devolve o que falta: `images` (nenhuma imagem) e `stock` (nenhuma variante ativa com estoque > 0).
    - Publicar exige lista vazia e situação `DRAFT`; o resultado é `ACTIVE` com `published_at`.
    - No produto ativo, trocar a grade ou as imagens também passa pela regra, mas só para "nenhuma imagem" e "nenhuma variante ativa" (AC-073). Estoque zero é permitido.
    - Erro 422 `PRODUCT_NOT_PUBLISHABLE`, com `missing`.
  - Transições no domínio, como em `sellers`:
    - `DRAFT` → `ACTIVE` (vendedor);
    - `ACTIVE` → `SUSPENDED` (admin, com motivo);
    - `SUSPENDED` → `ACTIVE` (admin);
    - qualquer uma, menos `ARCHIVED`, → `ARCHIVED` (vendedor);
    - o resto vira `INVALID_STATE_TRANSITION`.
  - Rotas do admin em `@AdminController('products')`, com `@Audited` (`product.suspend`, `product.reinstate`) e `AuditTrail.record` na mesma transação (estado antes e depois, ASM-028). O motivo segue as regras do `decisionReasonSchema` do `sellers`.
  - A moderação não exige `If-Match`, mas incrementa a versão, para a aba do vendedor perceber a mudança.

## T-024 — Limpeza das imagens órfãs [pendente]
- Refs: US-030, AC-081
- Arquivos: apps/api/src/shared/queue/job-queue.port.ts, apps/api/src/shared/queue/pg-boss.job-queue.ts, apps/api/src/modules/media/media.module.ts, apps/api/src/modules/media/application/upload.repository.ts, apps/api/src/modules/media/application/clean-orphan-uploads.use-case.ts, apps/api/src/modules/media/infra/prisma-upload.repository.ts, apps/api/test/orphan-uploads.e2e-spec.ts
- Notas:
  - **Depende da T-022.** A porta `JobQueue` ganha `schedule(queue, cron)`, com o `schedule` do pg-boss. A limpeza roda de hora em hora, só com `RUN_WORKER=true`, como as outras filas (ADR-0010).
  - Órfão é o upload:
    - nunca usado: sem imagem com o caminho, e `created_at` com mais de 24 h;
    - ou desligado de um produto: `detached_at` com mais de 24 h.
  - O caso de uso recebe o relógio (`now`) para o teste.
  - Apaga do Storage em lotes de até 100. Apaga a linha de `uploads` só do que o Storage confirmou; o que falhar fica para a próxima rodada.
  - O teste chama o caso de uso direto, com o Storage falso da T-022, e confere também o registro da fila.

## T-025 — Telas do vendedor: meus produtos e formulário em etapas [pendente]
- Refs: US-031, AC-082, AC-083, AC-084, AC-085, AC-086
- Arquivos: apps/web/proxy.spec.ts, apps/web/next.config.ts, apps/web/lib/api/products.ts, apps/web/lib/api/products.spec.ts, apps/web/lib/products/variant-grid.ts, apps/web/lib/products/variant-grid.spec.ts, apps/web/lib/products/image-files.ts, apps/web/lib/products/image-files.spec.ts, apps/web/app/(account)/minha-loja/produtos/page.tsx, apps/web/app/(account)/minha-loja/produtos/novo/page.tsx, apps/web/app/(account)/minha-loja/produtos/[id]/page.tsx, apps/web/app/(account)/minha-loja/produtos/actions.ts, apps/web/components/product-list.tsx, apps/web/components/product-list.spec.tsx, apps/web/components/product-form.tsx, apps/web/components/product-form.spec.tsx, apps/web/components/variant-grid-editor.tsx, apps/web/components/variant-grid-editor.spec.tsx, apps/web/components/image-uploader.tsx, apps/web/components/image-uploader.spec.tsx, apps/web/components/my-store.tsx
- Notas:
  - **Depende do contrato da T-020 à T-023**, já na `main`. Mesmo padrão da T-019:
    - `serverApi()` com o token e os tipos do `@vitrine/api-client`;
    - Server Actions, com os erros da API junto ao campo (os campos têm o mesmo nome do `errors[].field`);
    - testes que renderizam com `react-dom/server` e recebem uma API de mentira.
  - O `proxy.ts` já protege `/minha-loja/*`; o `proxy.spec.ts` ganha os caminhos novos (AC-086).
  - Formulário: cada etapa é uma Server Action, que manda o `If-Match` com a versão guardada num campo oculto.
    - 412 vira o aviso "o produto mudou em outra aba", com "Recarregar", sem limpar o que foi digitado.
    - A primeira etapa cria o rascunho e leva para `/minha-loja/produtos/{id}`.
  - Gerador de grade: função pura em `lib/products/variant-grid.ts`.
    - Recebe tamanhos, cores e as linhas atuais; devolve as linhas novas.
    - Mantém os valores das combinações que continuam (AC-084).
    - Os tamanhos vêm do `sizeType` da categoria, com a mesma lista da T-021.
  - Imagens: regra pura em `lib/products/image-files.ts` (tipo, até 5 MB, no máximo 8). Os arquivos sobem do navegador direto para a URL assinada; depois, a ordem e as cores são salvas com `PUT .../images`.
  - O `next.config.ts` libera o domínio do Supabase em `images.remotePatterns`.
  - O `MyStore` ganha o link "Meus produtos" para a loja aprovada.
