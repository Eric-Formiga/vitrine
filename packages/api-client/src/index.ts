import createClient, { type ClientOptions } from 'openapi-fetch';

import type { components, paths } from './schema';

// Cliente tipado da API da Vitrine (ADR-0008). Os tipos vêm de schema.d.ts, gerado do
// contrato OpenAPI por `pnpm api:generate`: se a API mudar e o site não acompanhar,
// o typecheck do site falha.

export type { components, paths };
export type Schemas = components['schemas'];

export type ApiClient = ReturnType<typeof createClient<paths>>;

export function createApiClient(baseUrl: string, options: Omit<ClientOptions, 'baseUrl'> = {}): ApiClient {
  return createClient<paths>({ ...options, baseUrl });
}
