# Spec 03 — Catálogo e busca

**Requisitos:** RF-CAT-1..8 · RNF-1, RNF-2 · **Módulos Nest:** `catalog`, `search`, `media`

## Objetivo
Vendedores cadastram produtos de moda com variantes; compradores encontram produtos por navegação, filtros e busca textual em português.

## Modelo de produto
- **Produto**: título, descrição (markdown limitado), categoria (folha da árvore), condição (novo/usado), status.
- **Variante** = combinação tamanho × cor, com SKU, preço, preço "de" opcional, estoque, peso.
- **Tamanhos**: lista controlada por tipo de categoria (roupas: PP–XGG; calçados: 33–46; único: U).
- **Cores**: nome livre + `color_hex` (para swatch); normalizadas para filtro por paleta base (preto, branco, azul…).
- **Imagens**: 1–8, primeira é a capa; podem ser associadas a uma cor (trocar cor troca a galeria).

## Histórias e critérios de aceite

### H1 — Criar/editar produto (vendedor)
- Formulário em etapas: informações → variantes (gerador de grade: escolho tamanhos e cores e a matriz é criada) → imagens → revisão.
- Rascunho salvo automaticamente. Publicar exige ≥ 1 imagem, ≥ 1 variante com estoque, loja apta a vender (RN-2).
- Edição concorrente: `If-Match` com `updatedAt`; conflito → `412` e UI oferece recarregar.
- Mudar preço não afeta pedidos já feitos (snapshot) nem reservas ativas (preço é revalidado no checkout).
- Arquivar produto com pedidos mantém registro (RN-17); remove da vitrine.

### H2 — Upload de imagens
- `POST /seller/uploads` → `{ uploadUrl, path }` (URL assinada do Supabase Storage, 60 s).
- Cliente envia direto ao Storage; depois confirma no produto. Backend valida que o `path` pertence ao prefixo da loja (`sellers/{sellerId}/...`).
- Formatos jpeg/png/webp ≤ 5 MB; exibição via `next/image` (redimensionado, AVIF/WebP).
- Job remove arquivos órfãos com mais de 24 h.

### H3 — Listagem (PLP)
- Rotas: `/c/{categoria}` e `/busca?q=`.
- Filtros: categoria (inclui subcategorias), tamanho, cor, faixa de preço, loja, condição, "em promoção". Combináveis, refletidos na URL (compartilhável, indexável só para categoria pura).
- Facetas retornam contagem por valor considerando os demais filtros aplicados.
- Ordenação: relevância (só com `q`), mais novos, menor preço, maior preço, mais vendidos.
- Paginação por cursor com "carregar mais"; 24 por página.
- Só aparecem produtos `ACTIVE`, de lojas aptas, com ≥ 1 variante disponível (ou exibir "esgotado" no fim — decisão: **ocultar esgotados por padrão**, filtro "incluir esgotados").

### H4 — Busca textual
- `"camisa linho"` encontra "Camisa de Linho Off-White"; `"camiseta"` encontra "Camisetá" (acentos); `"camsia"` (erro) encontra "camisa" via trigram quando FTS retorna < 5 resultados.
- Busca considera título (peso A), categoria e nome da loja (peso B), descrição (peso C).
- Autocomplete: `GET /products?q=...&limit=6` com debounce 250 ms; mostra produtos e categorias.

### H5 — Página de produto (PDP)
- Galeria, título, loja (link), preço (com "de/por" e % off), seletor de cor (swatches) e tamanho; tamanhos indisponíveis aparecem riscados.
- Botão "Adicionar" desabilitado até escolher variante; mostra "Últimas 2 unidades" quando estoque ≤ 2.
- Guia de medidas da categoria em modal.
- Calcular frete por CEP.
- Avaliações com média, distribuição e fotos.
- "Mais desta loja" e "Você também pode gostar" (mesma categoria, faixa de preço próxima).
- SEO: `generateMetadata`, JSON-LD `Product` com `offers` e `aggregateRating`, canonical.

## Implementação da busca
- Coluna `search_vector` gerada: `setweight(to_tsvector('pt_unaccent', title), 'A') || ...` com config de texto `pt_unaccent` (portuguese + unaccent).
- Query: `websearch_to_tsquery('pt_unaccent', :q)` + `ts_rank_cd`; fallback `similarity(title, :q) > 0.3`.
- Facetas via CTE com o conjunto filtrado e `GROUP BY` por tamanho/cor/loja.
- Implementado atrás da porta `SearchEngine` para permitir trocar por Meilisearch (v2).

## Eventos
`ProductPublished`, `ProductUpdated`, `ProductArchived`, `StockChanged` → revalidação de cache (`revalidateTag`) e invalidação da busca em cache.
