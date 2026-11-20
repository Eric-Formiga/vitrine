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

## T-020 — Produtos no banco: criar, editar, listar e arquivar, com versão [concluida]
- Refs: US-023, AC-060, AC-061, AC-062, US-027, AC-074, AC-075, AC-076
- Arquivos: apps/api/prisma/schema.prisma, apps/api/prisma/migrations, apps/api/src/shared/http/if-match.ts, apps/api/src/shared/http/if-match.spec.ts, apps/api/src/shared/openapi/openapi.ts, apps/api/src/modules/sellers/sellers.module.ts, apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/domain/product.ts, apps/api/src/modules/catalog/domain/product.spec.ts, apps/api/src/modules/catalog/domain/product-errors.ts, apps/api/src/modules/catalog/application/category.repository.ts, apps/api/src/modules/catalog/infra/prisma-category.repository.ts, apps/api/src/modules/catalog/application/product.repository.ts, apps/api/src/modules/catalog/application/create-product.use-case.ts, apps/api/src/modules/catalog/application/update-product.use-case.ts, apps/api/src/modules/catalog/application/archive-product.use-case.ts, apps/api/src/modules/catalog/application/list-my-products.use-case.ts, apps/api/src/modules/catalog/infra/prisma-product.repository.ts, apps/api/src/modules/catalog/http/product.dto.ts, apps/api/src/modules/catalog/http/seller-products.controller.ts, apps/api/test/support/product-test-kit.ts, apps/api/test/seller-products.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md, docs/DATA_MODEL.md
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
  - Feito assim:
    - **Versão:** a escrita versionada é `ProductRepository.write(ref, work)`. Ela trava a linha do produto da loja (`FOR UPDATE`), confere a versão (404 ou 412), roda o trabalho e grava as mudanças com `version + 1`, na mesma transação.
      - O trabalho recebe uma `CatalogTransaction` opaca. Os repositórios de variantes e imagens (T-021, T-022) gravam nela com `prismaTransactionOf(tx)`.
      - O `If-Match` é o decorator `@IfMatch()`, que aceita `"3"`, `W/"3"` ou `3`.
    - **Slug:** o Prisma 7 declara o índice único parcial do SKU no schema (`partialIndexes`, prévia), sem SQL solto. O slug não muda com o título.
    - **Contrato:** o `openapi.ts` ganhou as descrições de 412 e 428. A ordem das rotas no `openapi.json` mudou porque o `CatalogModule` passou a importar o `SellersModule`; nenhuma rota antiga mudou.
    - **Capa:** a lista devolve `coverUrl: null` até a T-022 ligar o caminho da capa à URL pública (`toSellerProductSummary` recebe a função).
    - **Testes:** o `product-test-kit.ts` cria a loja direto no banco, com o documento cifrado pelo cofre da própria API.

## T-021 — Grade de variantes e ajuste rápido de estoque [concluida]
- Refs: US-024, AC-063, AC-064, AC-065, AC-066, US-028, AC-077, AC-078
- Arquivos: apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/application/create-product.use-case.ts, apps/api/src/modules/catalog/application/update-product.use-case.ts, apps/api/src/modules/catalog/domain/size-grid.ts, apps/api/src/modules/catalog/domain/variant.ts, apps/api/src/modules/catalog/domain/variant-errors.ts, apps/api/src/modules/catalog/domain/variant.spec.ts, apps/api/src/modules/catalog/application/variant.repository.ts, apps/api/src/modules/catalog/application/replace-variants.use-case.ts, apps/api/src/modules/catalog/application/adjust-stock.use-case.ts, apps/api/src/modules/catalog/infra/prisma-variant.repository.ts, apps/api/src/modules/catalog/http/variant.dto.ts, apps/api/src/modules/catalog/http/seller-variants.controller.ts, apps/api/test/support/product-test-kit.ts, apps/api/test/seller-variants.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md
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
  - Vindo da T-020: trocar a categoria de um produto com variantes ativas por uma de outro `sizeType` precisa ser recusado (422), senão a grade fica com tamanhos fora da lista. A regra entra no `UpdateProductUseCase`.
  - Feito assim:
    - **Grade:** `planGrid` (domínio) confere a grade inteira e monta a troca: criar, atualizar (inclui reativar), arquivar, as cores que ficam e o menor preço.
      - O formato (limites, hex, SKU) fica no Zod, com as constantes do domínio. O que depende do produto fica no `planGrid`: tamanho da categoria, combinação repetida, preço "de", SKU repetido na grade e estoque abaixo do reservado.
      - A cor não diferencia maiúsculas ("Preto" e "preto" são a mesma variante); o nome novo é gravado.
      - A variante que continua sem SKU informado guarda o SKU que já tinha.
    - **Gravação:** a grade roda dentro do `ProductRepository.write`. O repositório confere o SKU nas outras variantes ativas da loja antes de gravar (409 com o SKU exato); o índice parcial segura uma corrida (409 sem o SKU). Arquiva primeiro, para liberar o SKU de quem sai.
    - **Leitura:** `GET /v1/seller/products/{id}/variants` devolve a grade ativa com o ETag, para a tela da T-025 editar.
    - **Estoque:** um `UPDATE ... FROM products` só, com o produto não arquivado e o novo valor entre o reservado e 99.999. Sem linha gravada, uma leitura decide o erro: 404, 422 `INVALID_STATE_TRANSITION` (produto arquivado), 422 `STOCK_WOULD_BE_NEGATIVE` (com `currentStock`) ou 400 no campo (passaria de 99.999).
    - **Categoria:** 422 `SIZE_GRID_MISMATCH`, com o `sizeType` novo. Com a grade vazia, a troca passa.
    - **Prova por mutação:** 10 defeitos injetados (ajuste que lê e grava separado, apagar em vez de arquivar, SKU de outro produto, cor da foto, e outros); os 10 derrubaram algum teste.

## T-022 — Imagens: Supabase Storage, URL de upload e imagens do produto [concluida]
- Refs: US-025, AC-062, AC-067, AC-068, AC-069, AC-070
- Arquivos: .env.example, apps/api/vitest.config.ts, apps/api/src/shared/config/env.ts, apps/api/src/shared/config/env.spec.ts, apps/api/src/app.module.ts, apps/api/src/create-app.ts, apps/api/src/modules/media/media.module.ts, apps/api/src/modules/media/domain/upload.ts, apps/api/src/modules/media/domain/upload.spec.ts, apps/api/src/modules/media/application/storage-gateway.port.ts, apps/api/src/modules/media/application/upload.repository.ts, apps/api/src/modules/media/application/request-upload.use-case.ts, apps/api/src/modules/media/infra/supabase-storage.gateway.ts, apps/api/src/modules/media/infra/prisma-upload.repository.ts, apps/api/src/modules/media/http/upload.dto.ts, apps/api/src/modules/media/http/seller-uploads.controller.ts, apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/domain/product-image.ts, apps/api/src/modules/catalog/application/product-image.repository.ts, apps/api/src/modules/catalog/application/replace-images.use-case.ts, apps/api/src/modules/catalog/infra/prisma-product-image.repository.ts, apps/api/src/modules/catalog/http/product-image.dto.ts, apps/api/src/modules/catalog/http/seller-product-images.controller.ts, apps/api/src/modules/catalog/http/seller-products.controller.ts, apps/api/test/support/admin-test-kit.ts, apps/api/test/support/storage-test-kit.ts, apps/api/test/support/supabase-sandbox.ts, apps/api/test/support/http-cassette.ts, apps/api/test/fixtures/supabase, apps/api/test/support/product-test-kit.ts, apps/api/test/seller-product-images.e2e-spec.ts, apps/api/test/supabase-storage.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md
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
  - Vindo da T-020: a lista "Meus produtos" passa a devolver a URL pública da capa (`coverUrl`, AC-062), com o `StorageGateway.publicUrl` no `SellerProductsController`. Um teste novo, anotado com AC-062, prova isso.
  - **Bloqueio:** gravar o cassete exige o projeto Supabase do dono, com o bucket público `product-images` (5 MB; jpeg/png/webp).
  - Feito assim:
    - **Validade da URL:** a gravação mostrou que o Supabase hospedado dá 2 horas fixas à URL de upload, e não 60 s. O dono aceitou (ASM-032); o AC-067, a ARCHITECTURE e a spec 03 foram ajustados. O adaptador lê a validade do próprio token (JWT, `exp`).
    - **Adaptador:** objeto inexistente vem como 400 com `error: "not_found"`, e o `stat` devolve nulo. A resposta do `GET /object/info` traz `size` e `content_type`. Erro do Storage vira 503 `STORAGE_UNAVAILABLE`.
    - **Cassete:** o `http-cassette.ts` grava corpo binário só pelo tamanho e tira a assinatura de todo JWT (o conteúdo fica, para a validade ser lida na reprodução). Conferido: a gravação não tem a chave nem o endereço do projeto. Regravar: `SUPABASE_RECORD=1`; o arquivo de teste vai para uma pasta de loja que não existe e é apagado no fim.
    - **Imagens:** o Storage é consultado antes da transação, para a rede não segurar a trava do produto. Depois vêm, por posição: a pasta, o registro do upload, o arquivo no Storage (tipo e tamanho reais) e a cor. A primeira imagem com problema dá o 422. A cor gravada é o nome da variante ("preto" vira "Preto").
    - **Limpeza:** quem sai da lista ganha `detached_at` só se nenhum outro produto usa o arquivo; quem entra o perde.
    - **Leitura:** `GET /v1/seller/products/{id}/images` devolve a lista com o ETag, para a tela da T-025.
    - **Prova por mutação:** 11 defeitos injetados; todos derrubaram algum teste. Um sobreviveu na primeira rodada porque o código conferia dois sinais equivalentes de "não existe"; ficou só um, e o defeito passou a ser pego.

## T-023 — Publicar, manter o produto ativo completo e moderação do admin [concluida]
- Refs: US-026, AC-071, AC-072, AC-073, US-029, AC-079, AC-080
- Arquivos: apps/api/src/modules/catalog/catalog.module.ts, apps/api/src/modules/catalog/domain/product.ts, apps/api/src/modules/catalog/domain/product.spec.ts, apps/api/src/modules/catalog/domain/product-errors.ts, apps/api/src/modules/catalog/application/product.repository.ts, apps/api/src/modules/catalog/application/publish-product.use-case.ts, apps/api/src/modules/catalog/application/moderate-product.use-case.ts, apps/api/src/modules/catalog/application/archive-product.use-case.ts, apps/api/src/modules/catalog/application/product-image.repository.ts, apps/api/src/modules/catalog/infra/prisma-product-image.repository.ts, apps/api/src/modules/catalog/application/replace-variants.use-case.ts, apps/api/src/modules/catalog/application/replace-images.use-case.ts, apps/api/src/modules/catalog/infra/prisma-product.repository.ts, apps/api/src/modules/catalog/http/product.dto.ts, apps/api/src/modules/catalog/http/seller-products.controller.ts, apps/api/src/modules/catalog/http/admin-products.controller.ts, apps/api/test/support/product-test-kit.ts, apps/api/test/product-publishing.e2e-spec.ts, apps/api/test/admin-products.e2e-spec.ts, packages/api-client/openapi.json, packages/api-client/src/schema.d.ts, docs/API.md
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
  - Feito assim:
    - **Situação:** `transition(product, change, now)` no domínio decide publicar, suspender, reativar e arquivar a partir de uma tabela de origens. O arquivamento passou a usar a mesma função. Reativar mantém o `publishedAt` e limpa o motivo e a data da suspensão.
    - **Completo para vender:** `publishIssues` (publicar: `images`, `stock`) e `listedIssues` (produto publicado: `images`, `variants`). A regra de continuar completo vale também para o suspenso, que volta a ativo ao ser reativado. O rascunho pode ficar vazio enquanto é montado.
    - **Publicar:** confere a situação antes do conteúdo; conta as fotos e o estoque das variantes ativas na transação da escrita versionada.
    - **Moderação:** `ProductRepository.moderate` trava o produto pelo id, sem conferir a versão, sobe a versão e grava a auditoria (status, motivo, data da suspensão e versão, antes e depois) na mesma transação. O motivo usa o `decisionReasonSchema` do `sellers`. A resposta é o `AdminProduct` (o produto com o `sellerId`).
    - **Testes:** o `insertVariant` do kit passou a usar o id inteiro do produto no SKU: o UUID v7 começa pelo horário, e dois produtos criados no mesmo instante repetiam o SKU.

## T-024 — Limpeza das imagens órfãs [concluida]
- Refs: US-030, AC-081
- Arquivos: apps/api/src/shared/queue/job-queue.port.ts, apps/api/src/shared/queue/pg-boss.job-queue.ts, apps/api/src/modules/media/media.module.ts, apps/api/src/modules/media/application/upload.repository.ts, apps/api/src/modules/media/application/clean-orphan-uploads.use-case.ts, apps/api/src/modules/media/infra/prisma-upload.repository.ts, apps/api/test/support/storage-test-kit.ts, apps/api/test/orphan-uploads.e2e-spec.ts, docs/ARCHITECTURE.md
- Notas:
  - **Depende da T-022.** A porta `JobQueue` ganha `schedule(queue, cron)`, com o `schedule` do pg-boss. A limpeza roda de hora em hora, só com `RUN_WORKER=true`, como as outras filas (ADR-0010).
  - Órfão é o upload:
    - nunca usado: sem imagem com o caminho, e `created_at` com mais de 24 h;
    - ou desligado de um produto: `detached_at` com mais de 24 h.
  - O caso de uso recebe o relógio (`now`) para o teste.
  - Apaga do Storage em lotes de até 100. Apaga a linha de `uploads` só do que o Storage confirmou; o que falhar fica para a próxima rodada.
  - O teste chama o caso de uso direto, com o Storage falso da T-022, e confere também o registro da fila.
  - Feito assim:
    - **Agendamento:** `JobQueue.schedule(queue, cron)` guarda o cron, e o pg-boss o grava em `pgboss.schedule` na subida, com o fuso de São Paulo, só com `RUN_WORKER=true`. A fila é `media.clean-orphan-uploads`, `0 * * * *`. Como o agendamento fica no banco, com mais de uma instância o pg-boss põe um job só por horário.
    - **Órfão:** nenhuma foto de produto usa o arquivo e, antes do corte de 24 h, ele foi criado e nunca usado (`detached_at` nulo) ou foi desligado (`detached_at`). Os mais antigos saem primeiro.
    - **Lotes:** até 100 por chamada ao Storage, repetindo até sobrar menos de um lote. Se o Storage falhar, a rodada para ali (`pending: true`) e nada sai do registro.
    - **Corrida aceita:** um arquivo sem uso há mais de 24 h, posto num produto no mesmo instante da limpeza, pode perder o arquivo no Storage. O registro não sai, porque a remoção confere de novo que ninguém o usa. A janela é de milissegundos, para um arquivo esquecido há um dia.
    - **Prova por mutação:** 9 defeitos injetados (prazos, arquivo em uso, falha do Storage, lotes, agendamento e fuso); os 9 derrubaram algum teste.

## T-025 — Telas do vendedor: meus produtos e formulário em etapas [pendente]
- Refs: US-031, AC-082, AC-083, AC-084, AC-085, AC-086
- Arquivos: apps/web/proxy.spec.ts, apps/web/next.config.ts, apps/web/lib/api/products.ts, apps/web/lib/api/products.spec.ts, apps/web/lib/products/variant-grid.ts, apps/web/lib/products/variant-grid.spec.ts, apps/web/lib/products/image-files.ts, apps/web/lib/products/image-files.spec.ts, apps/web/app/(account)/minha-loja/produtos/page.tsx, apps/web/app/(account)/minha-loja/produtos/novo/page.tsx, apps/web/app/(account)/minha-loja/produtos/[id]/page.tsx, apps/web/app/(account)/minha-loja/produtos/actions.ts, apps/web/components/product-list.tsx, apps/web/components/product-list.spec.tsx, apps/web/components/product-form.tsx, apps/web/components/product-form.spec.tsx, apps/web/components/variant-grid-editor.tsx, apps/web/components/variant-grid-editor.spec.tsx, apps/web/components/image-uploader.tsx, apps/web/components/image-uploader.spec.tsx, apps/web/components/my-store.tsx, apps/web/components/my-store.spec.tsx, apps/web/components/product-form-parts.tsx, apps/web/lib/products/shrink-image.ts
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
  - Redução no navegador (Q-013, decidido em 19/11/2026): lado maior até 1600 px, em WebP (qualidade 0,85; JPEG se o navegador não gerar WebP). O tipo é conferido antes; o arquivo escolhido pode ter até 20 MB; o limite de 5 MB vale para o reduzido.
  - O `next.config.ts` libera o domínio do Supabase em `images.remotePatterns`.
  - O `MyStore` ganha o link "Meus produtos" para a loja aprovada.
  - Feito assim:
    - **Etapas:** a URL é `/minha-loja/produtos/{id}?etapa=informacoes|variantes|imagens|revisao`. Cada etapa é um formulário com o `productId` e a `version` ocultos; a Server Action grava com `If-Match: "<version>"` e, com sucesso, redireciona para a próxima etapa, que abre na versão nova. O produto novo só tem a primeira etapa.
    - **Regras fora do React:** `lib/api/products.ts` monta cada chamada e transforma o problem+json em `StepState`: erros por campo com o nome da API (`title`, `variants.2.priceCents`, `images.1` para o `INVALID_IMAGE`), `conflict` para o 412, `missing` para o `PRODUCT_NOT_PUBLISHABLE`. Os testes usam uma API de mentira que anota o `If-Match` de cada chamada.
    - **Conflito (AC-086):** o aviso usa um `<a>` comum para "Recarregar", e não o `Link` do Next, para a página recarregar inteira: um `Link` para a mesma URL podia manter o estado dos componentes e mostrar o digitado antigo.
    - **Grade:** o editor guarda tamanhos, cores e linhas no estado do navegador e manda a grade em JSON num campo oculto. O preço é digitado em reais ("199,90"); o que não converte (preço, estoque, peso) volta como erro no mesmo campo da API, sem chamá-la. A cor não diferencia maiúsculas, como na API.
    - **Fotos:** `uploadPhoto` (puro, com a redução, o pedido da URL e o PUT injetados) faz o caminho de cada foto e para no primeiro passo recusado. A redução com canvas fica em `lib/products/shrink-image.ts`, a única parte sem teste automático (precisa de navegador). A URL assinada é pedida por uma Server Action (o token fica no servidor); o PUT vai direto do navegador ao Storage.
    - **Imagens na tela:** `<img>` simples com a URL pública (spec: a exibição otimizada é da `vitrine`); o `remotePatterns` do `next.config.ts` já libera o Supabase para quando ela vier.
    - **Prova por mutação:** 11 defeitos injetados (grade que perde o digitado ou sai fora de ordem, tipo errado aceito, foto reduzida acima de 5 MB enviada, foto pequena aumentada, If-Match fixo, 412 sem aviso, lista sem motivo da suspensão, "Publicar" com produto incompleto, link para loja não aprovada, sem limite de 8); os 11 derrubaram algum teste.
