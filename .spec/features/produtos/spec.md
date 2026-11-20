# Spec: Produtos — cadastro com variantes, imagens, estoque e moderação

> feature: produtos
> status: rascunho

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Contexto

Terceira feature da Fase 1 do [roadmap](../../../docs/ROADMAP.md). A loja aprovada (feature `vendedores`) cadastra os produtos dela:
- **informações:** título, descrição, categoria e condição;
- **grade de variantes:** cada combinação de tamanho × cor, com SKU, preço, preço "de", estoque e peso;
- **imagens:** de 1 a 8, enviadas direto do navegador para o Supabase Storage com uma URL assinada ([ADR-0004](../../../docs/adr/0004-supabase-postgres-prisma.md)).

O produto nasce como rascunho e só é publicado quando está completo e a loja pode vender (RN-2). Além disso:
- duas abas editando o mesmo produto não se sobrescrevem;
- o estoque tem um ajuste rápido que não perde atualizações;
- o admin suspende e reativa produtos;
- um job apaga do Storage as imagens enviadas e nunca usadas.

No site, o vendedor tem a lista "Meus produtos" e um formulário em etapas, que grava a cada etapa.

O produto publicado ainda não aparece para o comprador: listagem, página de produto e cache ficam para a feature `vitrine`, e a busca para a feature `busca`.

Decisões do dono do produto (16/11/2026):
- **Telas:** API e telas do vendedor ("Meus produtos" e o formulário em etapas, com o gerador de grade).
- **Storage:** um projeto Supabase (plano grátis) criado pelo dono, com a prova contra o Storage real gravada em cassete, como o sandbox do Asaas (ASM-012).
- **Extras incluídos:** edição concorrente (If-Match → 412), ajuste rápido de estoque, moderação do admin e limpeza das imagens órfãs.
- **Rascunho:** gravado a cada etapa do formulário, sem autosave contínuo.

Base:
- [PRD](../../../docs/PRD.md): RF-CAT-1, 2 e 3, RF-ADM-2, RN-1, RN-2 e RN-17;
- [spec 03](../../../docs/specs/03-catalogo-e-busca.md): modelo de produto, H1 e H2;
- [API](../../../docs/API.md): `/seller/products`, `/seller/variants`, `/seller/uploads` e `/admin/products`;
- [DATA_MODEL](../../../docs/DATA_MODEL.md): `products`, `product_variants` e `product_images`;
- [ARCHITECTURE](../../../docs/ARCHITECTURE.md): uploads com URL assinada (2 h no Supabase, ASM-032), jpeg/png/webp de até 5 MB, e a porta `StorageGateway`.

## Histórias

### US-023 — O vendedor cadastra um produto como rascunho

Como vendedor com loja aprovada, quero criar um produto com as informações básicas e voltar a ele depois, para montar o cadastro aos poucos.

#### AC-060 — Criar o rascunho de um produto

- **Dado** um vendedor com loja aprovada e uma categoria ativa sem subcategorias (uma "folha" da árvore)
- **Quando** ele envia título, descrição, categoria e condição (`POST /v1/seller/products`)
- **Então** o produto é criado como rascunho (`DRAFT`), da loja dele, com um slug gerado do título e único dentro da loja (`-2`, `-3`... quando repetir)
- **E** a resposta traz o cabeçalho `ETag` com a versão do produto

#### AC-061 — Informações inválidas são recusadas com o motivo de cada campo

- **Dado** um produto com título fora de 3 a 120 caracteres, descrição acima de 5.000, condição diferente de `NEW` ou `USED`, ou categoria inexistente, arquivada ou com subcategorias
- **Quando** ele é criado ou editado
- **Então** a resposta é 400 (`VALIDATION_FAILED`), com o campo de cada erro
- **E** nada é gravado

#### AC-062 — O vendedor lista e abre só os próprios produtos

- **Dado** duas lojas aprovadas, cada uma com produtos em situações diferentes
- **Quando** um vendedor lista os produtos (`GET /v1/seller/products`, com filtro opcional de situação) e abre um deles (`GET /v1/seller/products/{id}`)
- **Então** a lista traz só os produtos da loja dele, do mais recente para o mais antigo, com a capa, o menor preço e o estoque total
- **E** abrir o produto de outra loja responde 404, como se ele não existisse

### US-024 — O vendedor monta a grade de variantes

Como vendedor, quero escolher os tamanhos e as cores e preencher preço e estoque de cada combinação, para vender o mesmo modelo em várias opções.

#### AC-063 — Salvar a grade de variantes

- **Dado** um produto de uma categoria de roupas
- **Quando** o vendedor envia a grade (`PUT /v1/seller/products/{id}/variants`), em que cada combinação de tamanho × cor tem preço, preço "de" opcional, estoque, peso, código hexadecimal da cor e SKU opcional
- **Então** a grade fica salva, e o SKU omitido é gerado a partir do slug, do tamanho e da cor
- **E** o produto passa a ter como menor preço o da variante mais barata

#### AC-064 — Grade inválida é recusada inteira

- **Dado** uma grade com tamanho fora da lista do tipo da categoria (roupas PP a XGG, calçados 33 a 46, tamanho único U), combinação de tamanho e cor repetida, preço menor ou igual a zero, preço "de" menor ou igual ao preço, estoque negativo, peso fora de 1 g a 30 kg ou cor sem hexadecimal válido
- **Quando** ela é enviada
- **Então** a resposta é 400, com o campo de cada erro (ex.: `variants.2.priceCents`)
- **E** a grade anterior continua como estava

#### AC-065 — O SKU é único dentro da loja

- **Dado** uma variante ativa de outro produto da mesma loja com o SKU `VEST-M-PRETO`
- **Quando** a grade de um produto traz uma variante com esse SKU
- **Então** a resposta é 409 (`SKU_TAKEN`), com o SKU repetido
- **E** outra loja pode usar o mesmo SKU sem conflito

#### AC-066 — Trocar a grade preserva as variantes que continuam

- **Dado** um produto com as variantes M/preto e G/preto
- **Quando** o vendedor envia uma grade nova com M/preto (preço novo) e P/preto
- **Então** M/preto mantém o mesmo identificador, com o preço novo; P/preto é criada; G/preto é arquivada, não apagada
- **E** se G/preto voltar numa grade futura, a variante arquivada é reativada com o mesmo identificador

### US-025 — O vendedor envia as fotos do produto

Como vendedor, quero enviar até 8 fotos, escolher a ordem e dizer de qual cor é cada uma, para o comprador ver o produto como ele é.

#### AC-067 — Pedir uma URL de upload

- **Dado** um vendedor com loja aprovada
- **Quando** ele pede uma URL de upload (`POST /v1/seller/uploads`) com o tipo (`image/jpeg`, `image/png` ou `image/webp`) e o tamanho do arquivo (até 5 MB)
- **Então** a resposta traz a URL assinada do Storage, com a validade que o Storage dá a ela (`expiresAt`, ASM-032), e o caminho do arquivo dentro da pasta da loja (`sellers/{sellerId}/...`)
- **E** outro tipo de arquivo ou mais de 5 MB respondem 400, sem pedir nada ao Storage

#### AC-068 — Salvar as imagens do produto

- **Dado** um produto e arquivos já enviados ao Storage pela URL assinada
- **Quando** o vendedor salva a lista de imagens (`PUT /v1/seller/products/{id}/images`), na ordem, com texto alternativo e cor opcional
- **Então** as imagens ficam salvas nessa ordem, a primeira é a capa, e cada uma traz a URL pública dela
- **E** a lista substitui a anterior; as imagens que saíram da lista vão para a limpeza (US-030)

#### AC-069 — Imagens inválidas são recusadas

- **Dado** uma lista com mais de 8 imagens, um caminho fora da pasta da loja, um arquivo que não está no Storage, um arquivo cujo tipo ou tamanho real foge do permitido, ou uma cor que nenhuma variante do produto tem
- **Quando** ela é salva
- **Então** a resposta é 400 para o formato da lista e 422 (`INVALID_IMAGE`) para o arquivo, com a posição e o motivo
- **E** as imagens anteriores continuam como estavam

#### AC-070 — O caminho real funciona contra o Supabase Storage

- **Dado** um projeto Supabase com o bucket de imagens de produto
- **Quando** o adaptador do Storage cria uma URL assinada, um arquivo é enviado por ela, o adaptador confere o arquivo (tipo e tamanho) e depois o apaga
- **Então** cada passo responde como o adaptador espera
- **E** a conversa fica gravada num cassete, para o teste rodar sem rede e sem chave

### US-026 — O vendedor publica o produto

Como vendedor, quero publicar o produto quando ele estiver completo, para ele poder ser vendido.

#### AC-071 — Publicar o produto completo

- **Dado** um rascunho com pelo menos uma imagem e pelo menos uma variante com estoque, de uma loja aprovada
- **Quando** o vendedor publica (`POST /v1/seller/products/{id}/publish`)
- **Então** o produto passa a ativo (`ACTIVE`), com a data de publicação

#### AC-072 — Produto incompleto não é publicado

- **Dado** um rascunho sem imagem, ou sem variante com estoque
- **Quando** o vendedor tenta publicar
- **Então** a resposta é 422 (`PRODUCT_NOT_PUBLISHABLE`), com a lista do que falta (`images`, `stock`)
- **E** o produto continua rascunho

#### AC-073 — O produto ativo continua completo

- **Dado** um produto ativo
- **Quando** o vendedor salva uma lista vazia de imagens ou uma grade vazia
- **Então** a resposta é 422 (`PRODUCT_NOT_PUBLISHABLE`), e o produto não muda
- **E** zerar o estoque de todas as variantes é permitido: o produto fica ativo, mas esgotado

### US-027 — O vendedor edita sem perder o que outra aba gravou, e arquiva

Como vendedor, quero editar o produto sem sobrescrever o que gravei em outra aba, e arquivar o que não vendo mais sem perder o histórico.

#### AC-074 — Edição com a versão certa

- **Dado** um produto na versão 3 (`ETag: "3"`)
- **Quando** o vendedor edita as informações, a grade ou as imagens enviando `If-Match: "3"`
- **Então** a mudança é gravada, e a resposta traz `ETag: "4"`

#### AC-075 — Versão desatualizada ou ausente é recusada

- **Dado** um produto na versão 4
- **Quando** chega uma escrita do vendedor (editar, grade, imagens, publicar ou arquivar) com `If-Match: "3"`, ou sem `If-Match`
- **Então** a versão desatualizada responde 412 (`PRODUCT_VERSION_CONFLICT`), com a versão atual
- **E** a escrita sem `If-Match` responde 428 (`PRECONDITION_REQUIRED`); nos dois casos, nada muda

#### AC-076 — Arquivar tira o produto de cena sem apagar

- **Dado** um produto em rascunho, ativo ou suspenso
- **Quando** o vendedor arquiva (`DELETE /v1/seller/products/{id}`, com `If-Match`)
- **Então** o produto passa a arquivado (`ARCHIVED`) e continua no banco, com as variantes e as imagens (RN-17)
- **E** um produto arquivado não aceita mais edição, grade, imagens nem publicação (422 `INVALID_STATE_TRANSITION`)

### US-028 — O vendedor ajusta o estoque rapidamente

Como vendedor, quero corrigir o estoque de uma variante sem reenviar o produto inteiro, para manter a quantidade em dia depois de uma venda fora da Vitrine ou de uma reposição.

#### AC-077 — Ajustar por diferença ou por valor final

- **Dado** uma variante com estoque 10, de um produto da loja do vendedor
- **Quando** ele envia `{ "delta": -3 }` ou `{ "absolute": 25 }` (`PATCH /v1/seller/variants/{id}/stock`)
- **Então** o estoque passa a 7 ou a 25, e a resposta traz o valor novo
- **E** a variante de outra loja responde 404

#### AC-078 — Ajustes simultâneos não se perdem e o estoque nunca fica negativo

- **Dado** uma variante com estoque 10
- **Quando** chegam 10 ajustes `{ "delta": -1 }` ao mesmo tempo, seguidos de um `{ "delta": -5 }`
- **Então** os 10 primeiros são todos aplicados (estoque 0), sem perder nenhum
- **E** o `-5` responde 422 (`STOCK_WOULD_BE_NEGATIVE`), e o estoque continua 0

### US-029 — O admin suspende e reativa produtos

Como admin, quero suspender um produto que fere as regras da Vitrine e reativá-lo depois da correção, com o motivo registrado.

#### AC-079 — Suspender e reativar, sempre com registro

- **Dado** um produto ativo
- **Quando** o admin suspende com um motivo (`POST /v1/admin/products/{id}/suspend`) e depois reativa (`POST /v1/admin/products/{id}/reinstate`)
- **Então** o produto passa a suspenso, com o motivo e a data, e depois volta a ativo
- **E** cada decisão vai para a trilha de auditoria, com o admin, o estado antes e o depois

#### AC-080 — Decisão fora de hora e acesso de quem não é admin

- **Dado** um produto em rascunho ou arquivado, e um produto suspenso
- **Quando** o admin tenta suspender o primeiro, o vendedor tenta publicar o suspenso, ou quem não é admin chama as rotas
- **Então** as duas primeiras tentativas respondem 422 (`INVALID_STATE_TRANSITION`); suspender sem motivo responde 400
- **E** quem não é admin recebe 404

### US-030 — As imagens enviadas e nunca usadas são apagadas

Como dona da Vitrine, quero que os arquivos enviados e não usados em nenhum produto sejam apagados do Storage, para não pagar por lixo.

#### AC-081 — A limpeza apaga só os órfãos com mais de 24 horas

- **Dado** um upload de 25 horas atrás nunca usado, um de 2 horas atrás nunca usado, uma imagem tirada de um produto há 25 horas e uma imagem em uso
- **Quando** o job de limpeza roda
- **Então** os dois arquivos com mais de 24 horas são apagados do Storage e do registro de uploads
- **E** o upload recente e a imagem em uso ficam; se o Storage falhar, o arquivo fica para a próxima rodada

### US-031 — O vendedor cadastra produtos pelo site

Como vendedor, quero cadastrar e acompanhar os meus produtos pelo site, em etapas, sem precisar da API.

#### AC-082 — Página "Meus produtos"

- **Dado** um vendedor com loja aprovada, com e sem produtos
- **Quando** ele abre `/minha-loja/produtos`
- **Então** vê cada produto com a capa, o título, a situação (rascunho, ativo, suspenso com o motivo, arquivado), o menor preço e o estoque total, além do botão "Novo produto"
- **E** sem produtos, vê um convite para cadastrar o primeiro; com a loja não aprovada, vê o aviso de que só a loja aprovada cadastra produtos

#### AC-083 — Formulário em etapas, gravando a cada etapa

- **Dado** o formulário de produto (`/minha-loja/produtos/novo` e `/minha-loja/produtos/{id}`)
- **Quando** o vendedor passa pelas etapas informações → variantes → imagens → revisão
- **Então** cada "Próximo" grava a etapa na API (a primeira cria o rascunho); os erros da API aparecem junto ao campo, e o que foi digitado continua no formulário
- **E** a revisão mostra o que falta para publicar (`PRODUCT_NOT_PUBLISHABLE`) ou o botão "Publicar"

#### AC-084 — Gerador de grade

- **Dado** a etapa de variantes de um produto de roupas
- **Quando** o vendedor marca os tamanhos (da lista da categoria) e adiciona cores (nome e cor)
- **Então** a tabela ganha uma linha por combinação de tamanho × cor, com preço, preço "de", estoque, peso e SKU
- **E** marcar ou desmarcar um tamanho ou uma cor mantém os valores já digitados nas linhas que continuam

#### AC-085 — Envio das fotos no navegador

- **Dado** a etapa de imagens
- **Quando** o vendedor escolhe arquivos
- **Então** os arquivos de outro tipo são recusados no navegador, com a mensagem, antes de qualquer envio; os válidos são reduzidos no navegador (lado maior até 1600 px, em WebP, Q-013), e a foto que mesmo reduzida passa de 5 MB é recusada antes de pedir a URL; as aceitas sobem direto ao Storage pela URL assinada
- **E** ele reordena as fotos (a primeira é a capa), escolhe a cor de cada uma e remove fotos; o limite de 8 aparece na tela

#### AC-086 — Conflito de versão e acesso

- **Dado** o produto alterado em outra aba depois que o formulário foi aberto
- **Quando** o vendedor grava uma etapa
- **Então** aparece o aviso de que o produto mudou em outra aba, com o botão "Recarregar"; o que estava digitado não se perde até ele recarregar
- **E** `/minha-loja/produtos` e as páginas do formulário, sem login, levam ao login guardando o endereço de volta

## Fora de escopo

- Listagem, página do produto, página da loja, cache e eventos de revalidação (`ProductPublished`, `revalidateTag`) → feature `vitrine`.
- Busca textual (`search_vector`, trigram) e facetas → feature `busca`. Aqui só o `min_price_cents` passa a ser mantido.
- Seed com 6 lojas e ~48 produtos (8 por loja; decidido em 16/11/2026, para caber folgado no Storage grátis) → feature `vitrine`.
- Reserva de estoque (`reserved`), revalidação do preço no checkout e preço congelado no pedido (RN-7) → Fase 2. A coluna `reserved` nasce aqui, sempre 0.
- Exibição otimizada das imagens (`next/image` com AVIF/WebP) na vitrine → feature `vitrine`; nas telas do vendedor, a imagem aparece pela URL pública.
- Lista de produtos para moderação no site do admin → Fase 4 (bônus). Aqui o admin age pelo identificador, via API ou `/docs`.
- Avisos por e-mail ao vendedor (produto suspenso) → Fase 2, com o outbox.
- Guia de medidas na página do produto → feature `vitrine` (o guia já existe na categoria, feature `categorias`).

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-023 | O produto só pode ficar numa categoria "folha" (sem subcategorias ativas), como diz a spec 03. Se a categoria for arquivada depois, o produto continua nela; quem decide o que muda é a feature `vitrine` | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-024 | O SKU é opcional na grade; quando omitido, é gerado como `SLUG-TAMANHO-COR` em maiúsculas, sem acentos. É único só entre as variantes ativas da mesma loja | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-025 | A descrição é texto puro de até 5.000 caracteres (quebras de linha preservadas). O "markdown limitado" da spec 03 fica para a feature `vitrine`, que decide como exibir | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-026 | A versão do produto é um número inteiro que sobe a cada escrita (`ETag: "n"`), em vez do `updatedAt` da spec 03: dois saves no mesmo milissegundo não colidem. O ajuste rápido de estoque não exige `If-Match`, porque um ajuste por diferença não sobrescreve o outro | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-027 | Trocar a grade removendo uma cor que tem imagens faz essas imagens valerem para todas as cores, sem erro | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-028 | As escritas do vendedor nos produtos não vão para a trilha de auditoria (são muitas e não envolvem dinheiro); só a moderação do admin vai | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-029 | Os produtos de uma loja suspensa continuam com a situação que tinham; a loja só não consegue mexer neles (403, feature `vendedores`), e a feature `vitrine` esconde os produtos de lojas que não estão aprovadas | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-030 | Arquivar é definitivo nesta feature: não há "desarquivar". Para vender de novo, o vendedor cria outro produto | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-031 | As imagens ficam num bucket público do Supabase Storage (leitura pública, escrita só pela URL assinada), com limite de 5 MB e tipos jpeg/png/webp configurados no próprio bucket; a API confere de novo o tipo e o tamanho reais ao salvar as imagens | confirmada | confirmado pelo dono do produto em 16/11/2026 |
| ASM-032 | A URL de upload assinada vale o que o Storage define, e a API informa essa validade em `expiresAt`. No Supabase hospedado são 2 horas, fixas (medido na gravação de 17/11/2026), e não os 60 segundos da spec 03. O risco é baixo: cada URL envia um arquivo só, num caminho só, sem sobrescrever; o bucket limita tipo e tamanho; a API confere o arquivo real; e a limpeza apaga o que não foi usado em 24 horas | confirmada | confirmado pelo dono do produto em 17/11/2026 |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-009 | Quais telas a feature entrega? | respondida | As do vendedor: "Meus produtos" e o formulário em etapas, com o gerador de grade (decidido em 16/11/2026) |
| Q-010 | Onde ficam as imagens, e como provamos o caminho real? | respondida | Supabase Storage, num projeto criado pelo dono; a prova contra o Storage real fica gravada em cassete (decidido em 16/11/2026) |
| Q-011 | Quais extras da spec 03 entram? | respondida | Edição concorrente, ajuste rápido de estoque, moderação do admin e limpeza das imagens órfãs (decidido em 16/11/2026) |
| Q-012 | Como o rascunho é salvo? | respondida | A cada etapa do formulário, sem autosave contínuo (decidido em 16/11/2026) |
| Q-013 | As fotos são reduzidas antes do envio? | respondida | Sim, no navegador: lado maior até 1600 px, em WebP (JPEG se o navegador não gerar WebP). O tipo é conferido antes; o arquivo escolhido pode ter até 20 MB, e o limite de 5 MB vale para o reduzido. A foto já pequena que ficaria maior ao converter vai como está (decidido em 19/11/2026) |
