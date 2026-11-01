# ADR-0007 — Busca com Postgres FTS + pg_trgm

**Status:** Aceita · **Data:** 2026-10-19

## Contexto
Busca textual em português (acentos, plurais, erros de digitação) com filtros facetados, num catálogo de milhares de produtos.

## Decisão
Full-text search nativo do Postgres com configuração `portuguese` + `unaccent`, coluna `tsvector` gerada com pesos, índice GIN, e `pg_trgm` como fallback para erros de digitação. Facetas por agregação SQL. Implementado atrás da porta `SearchEngine`.

## Alternativas
- **Meilisearch/Typesense**: relevância e tolerância a erros superiores, facetas prontas; exige outro serviço e sincronização. Planejado para v2 trocando apenas o adapter.
- **Elasticsearch/OpenSearch**: superdimensionado.
- **`ILIKE`**: sem relevância nem performance.

## Consequências
- (+) Zero infraestrutura extra, consistência imediata com o banco.
- (−) Relevância mais limitada; facetas complexas exigem SQL cuidadoso e índices bem pensados.
