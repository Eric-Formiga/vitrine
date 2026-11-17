import {
  type SignedUpload,
  type StorageGateway,
  StorageNotConfiguredError,
  StorageProviderError,
} from '../application/storage-gateway.port.js';
import type { StoredFile } from '../domain/upload.js';

export interface SupabaseStorageOptions {
  /** URL do projeto (https://<ref>.supabase.co). Sem ela, nem a URL pública sai. */
  url: string | undefined;
  /** Secret key do projeto. Sem ela, upload, consulta e remoção respondem 503. */
  secretKey: string | undefined;
  bucket: string;
  /** Injetável: o teste de contrato passa o cassete que grava e reproduz o Storage. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/** Validade usada quando o token não diz a sua (não deveria acontecer). */
const FALLBACK_TTL_MS = 60_000;

/**
 * Corpo de erro do Storage. Para objeto inexistente, ele responde 400 (não 404) com
 * `{ statusCode: "404", error: "not_found" }` (gravação de 17/11/2026).
 */
interface StorageErrorBody {
  error?: string;
  message?: string;
}

/** O que `GET /object/info` devolve, com os dois formatos que o Storage já usou. */
interface ObjectInfo {
  size?: number;
  content_type?: string;
  contentType?: string;
  metadata?: { size?: number; mimetype?: string; contentLength?: number } | null;
}

// Adaptador do Supabase Storage pela API REST, sem SDK: a conversa inteira passa pelo
// `fetch`, então cabe no cassete dos testes (AC-070). Bucket público: a URL pública não
// precisa de assinatura.
export class SupabaseStorageGateway implements StorageGateway {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: SupabaseStorageOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async createSignedUpload(path: string): Promise<SignedUpload> {
    const { body } = await this.call<{ url: string }>('POST', `/object/upload/sign/${this.objectKey(path)}`);
    // O Storage devolve o endereço relativo a /storage/v1, com o token na query.
    const uploadUrl = `${this.storageUrl()}${body.url}`;
    return { uploadUrl, expiresAt: tokenExpiry(uploadUrl) };
  }

  async stat(path: string): Promise<StoredFile | null> {
    const { status, body } = await this.call<ObjectInfo>('GET', `/object/info/${this.objectKey(path)}`, { allowNotFound: true });
    if (status === 404) return null;
    const contentType = body.content_type ?? body.contentType ?? body.metadata?.mimetype;
    const sizeBytes = body.size ?? body.metadata?.size ?? body.metadata?.contentLength;
    if (contentType === undefined || sizeBytes === undefined) {
      throw new StorageProviderError(status, `Resposta de info sem tipo ou tamanho: ${JSON.stringify(body)}`);
    }
    return { contentType, sizeBytes };
  }

  async remove(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.call('DELETE', `/object/${encodeURIComponent(this.options.bucket)}`, { body: { prefixes: paths } });
  }

  publicUrl(path: string): string | null {
    return this.options.url ? `${this.storageUrl()}/object/public/${this.objectKey(path)}` : null;
  }

  private storageUrl(): string {
    if (!this.options.url) throw new StorageNotConfiguredError();
    return `${this.options.url.replace(/\/$/, '')}/storage/v1`;
  }

  private objectKey(path: string): string {
    return [this.options.bucket, ...path.split('/')].map(encodeURIComponent).join('/');
  }

  private async call<T>(
    method: string,
    path: string,
    { body, allowNotFound = false }: { body?: unknown; allowNotFound?: boolean } = {},
  ): Promise<{ status: number; body: T }> {
    const key = this.options.secretKey;
    if (!key || !this.options.url) throw new StorageNotConfiguredError();

    const response = await this.fetchImpl(`${this.storageUrl()}${path}`, {
      method,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'user-agent': 'vitrine-api',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    const parsed = (text ? JSON.parse(text) : {}) as T & StorageErrorBody;
    if (response.ok) return { status: response.status, body: parsed };

    const notFound = response.status === 404 || parsed.error === 'not_found';
    if (allowNotFound && notFound) return { status: 404, body: parsed };
    throw new StorageProviderError(response.status, `${method} ${path}: ${parsed.message ?? parsed.error ?? text}`);
  }
}

/** A validade da URL assinada, lida do próprio token (um JWT com `exp`). */
function tokenExpiry(uploadUrl: string): Date {
  const token = new URL(uploadUrl).searchParams.get('token');
  const payload = token?.split('.')[1];
  try {
    const { exp } = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')) as { exp?: number };
    if (typeof exp === 'number') return new Date(exp * 1000);
  } catch {
    // Token fora do formato esperado: cai na validade padrão abaixo.
  }
  return new Date(Date.now() + FALLBACK_TTL_MS);
}
