import 'server-only';

import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Chamada à API a partir do servidor do Next, com o token da sessão do Clerk.
// O site nunca fala com o banco: tudo passa pela API (ARCHITECTURE §2).
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { getToken } = await auth();
  const token = await getToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(res.status, problem?.detail ?? `A API respondeu ${res.status}`);
  }
  return (await res.json()) as T;
}
