import { createApiClient } from '@vitrine/api-client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

// Cliente tipado para as rotas públicas da API (catálogo, categorias), sem token.
// Os tipos vêm do contrato OpenAPI (ADR-0008): se a API mudar, o typecheck do site acusa.
export const publicApi = createApiClient(API_URL);
