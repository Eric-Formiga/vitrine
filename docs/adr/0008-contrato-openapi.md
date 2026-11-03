# ADR-0008 — Contrato de API via OpenAPI gerado do backend

**Status:** Aceita · **Data:** 2026-10-19

## Contexto
Web e API precisam de tipos consistentes. Queremos também documentação interativa da API (bom para o portfólio).

## Decisão
- DTOs da API definidos com **Zod** (`nestjs-zod`), que valida entrada e gera o schema **OpenAPI** (`@nestjs/swagger`), exposto em `/docs`.
- Script `pnpm api:generate` exporta `openapi.json` e gera tipos com **openapi-typescript** em `packages/api-client`; o web usa **openapi-fetch** (cliente tipado, ~6 kB).
- CI regenera e falha se houver diff não commitado.

## Alternativas
- **tRPC**: ótima DX, mas acopla o cliente ao TypeScript e não produz uma API REST pública documentada.
- **Pacote de schemas Zod compartilhado sem OpenAPI**: tipagem boa, mas sem documentação padrão e sem contrato consumível por terceiros.
- **Orval**: gera hooks React Query prontos; mais código gerado. Pode ser adotado depois.

## Nota (03/11/2026)
O `nestjs-zod` 5.5 não suporta o Nest 12 (declara Nest 10/11 e `@nestjs/swagger` até 11). Os DTOs continuam em **Zod 4**, mas com cola própria: `ZodValidationPipe` / `@ZodBody` validam a entrada (erro 400 com `errors` por campo) e o schema vira JSON Schema com `z.toJSONSchema`, registrado no `@nestjs/swagger` 12. O resto da decisão (OpenAPI gerado do backend, `openapi-typescript` + `openapi-fetch` no web) não muda.

## Consequências
- (+) Uma fonte de verdade (DTOs Zod), docs automáticas, quebra de contrato detectada em compile time no web.
- (−) Passo de geração no fluxo de desenvolvimento (automatizado no `turbo dev` via watch).
