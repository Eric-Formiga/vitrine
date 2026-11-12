import type { ApiClient } from '@vitrine/api-client';

import { publicApi } from './public-client';

export interface Department {
  name: string;
  href: string;
}

/**
 * Departamentos (primeiro nível da árvore de categorias) para o menu do cabeçalho (AC-025).
 * Se a API falhar, estiver fora do ar ou demorar, devolve [] : o site abre sem o menu,
 * nunca quebra nem fica esperando por causa dele.
 */
export async function loadDepartments(
  api: ApiClient = publicApi,
  { timeoutMs = 2_000 }: { timeoutMs?: number } = {},
): Promise<Department[]> {
  const signal = AbortSignal.timeout(timeoutMs);
  const timedOut = new Promise<never>((_, reject) =>
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
  );

  try {
    const { data } = await Promise.race([api.GET('/v1/categories', { signal }), timedOut]);
    return (data ?? []).map(({ name, slug }) => ({ name, href: `/c/${slug}` }));
  } catch {
    return [];
  }
}
