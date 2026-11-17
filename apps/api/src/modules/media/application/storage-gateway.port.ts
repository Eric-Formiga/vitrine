// Porta do Storage (ADR-0004): os casos de uso falam com isto, nunca com o Supabase.
import { DomainError } from '../../../shared/errors/domain-error.js';
import type { StoredFile } from '../domain/upload.js';

export interface SignedUpload {
  /** Para o navegador enviar o arquivo com PUT, sem login no Storage. */
  uploadUrl: string;
  expiresAt: Date;
}

export interface StorageGateway {
  /** URL assinada para enviar um arquivo a `path` (uma vez, por pouco tempo). */
  createSignedUpload(path: string): Promise<SignedUpload>;
  /** Tipo e tamanho do arquivo como está no Storage; nulo se ele não existe. */
  stat(path: string): Promise<StoredFile | null>;
  /** Apaga os arquivos; os que já não existem são ignorados. */
  remove(paths: readonly string[]): Promise<void>;
  /** URL pública da imagem (bucket público, com CDN); nula sem o Storage configurado. */
  publicUrl(path: string): string | null;
}

export const STORAGE_GATEWAY = Symbol('STORAGE_GATEWAY');

/** Sem SUPABASE_URL e SUPABASE_SECRET_KEY, a API sobe e só as imagens ficam fora. */
export class StorageNotConfiguredError extends DomainError {
  readonly code = 'STORAGE_NOT_CONFIGURED';
  override readonly status = 503;

  constructor() {
    super('Envio de imagens indisponível: configure SUPABASE_URL e SUPABASE_SECRET_KEY.');
  }
}

/** O Storage respondeu com erro (fora do ar, chave errada...). */
export class StorageProviderError extends DomainError {
  readonly code = 'STORAGE_UNAVAILABLE';
  override readonly status = 503;

  constructor(httpStatus: number, detail: string) {
    super(`O Storage não respondeu como esperado (${httpStatus}). Tente de novo em instantes.`, { providerStatus: httpStatus });
    this.cause = detail;
  }
}
