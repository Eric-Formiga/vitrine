import { PaymentGatewayNotConfiguredError, PaymentProviderError } from '../../domain/payment-errors.js';

export interface AsaasHttpClientOptions {
  /** Chave da conta da plataforma. Sem ela, qualquer chamada falha antes de ir à rede. */
  apiKey: string | undefined;
  /** Ex.: https://api-sandbox.asaas.com/v3 */
  baseUrl: string;
  /** Injetável: os testes passam o "cassete" que grava e reproduz o sandbox. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

type Query = Record<string, string | number | undefined>;

/**
 * Erro do Asaas. Em geral { errors: [{ code, description }] }, mas algumas recusas
 * (ex.: 403 de permissão da conta) vêm como { message }.
 */
interface AsaasErrorBody {
  errors?: { code?: string; description?: string }[];
  message?: string;
}

// Cliente HTTP fino da API v3 do Asaas: autenticação, timeout e tradução de erros.
// Não conhece regra de negócio; quem monta os pedidos é o AsaasGateway.
export class AsaasHttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: AsaasHttpClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  get<T>(path: string, query?: Query): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  async request<T>(method: string, path: string, { query, body }: { query?: Query; body?: unknown } = {}): Promise<T> {
    const apiKey = this.options.apiKey;
    if (!apiKey) throw new PaymentGatewayNotConfiguredError();

    const url = new URL(`${this.options.baseUrl.replace(/\/$/, '')}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await this.fetchImpl(url, {
      method,
      headers: {
        access_token: apiKey,
        'content-type': 'application/json',
        'user-agent': 'vitrine-api',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      const error = parsed as AsaasErrorBody | undefined;
      const messages = [...(error?.errors ?? []).map((e) => e.description ?? e.code ?? ''), error?.message ?? ''];
      throw new PaymentProviderError(response.status, messages.filter(Boolean));
    }
    return parsed as T;
  }
}
