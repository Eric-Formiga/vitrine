import type { SignedUpload, StorageGateway } from '../../src/modules/media/application/storage-gateway.port.js';
import type { StoredFile } from '../../src/modules/media/domain/upload.js';

// Storage em memória para os testes da API: guarda o que "o navegador enviou" e responde
// como o Supabase. O caminho real é provado à parte, no cassete (AC-070).
export class FakeStorage implements StorageGateway {
  readonly files = new Map<string, StoredFile>();
  /** Caminhos para os quais a API pediu URL assinada, em ordem. */
  readonly signed: string[] = [];
  readonly removed: string[] = [];

  async createSignedUpload(path: string): Promise<SignedUpload> {
    this.signed.push(path);
    return { uploadUrl: `https://storage.test/upload/${path}?token=teste`, expiresAt: new Date(Date.now() + 7_200_000) };
  }

  /** O navegador enviando o arquivo pela URL assinada. */
  upload(path: string, file: Partial<StoredFile> = {}): void {
    this.files.set(path, { contentType: 'image/webp', sizeBytes: 120_000, ...file });
  }

  async stat(path: string): Promise<StoredFile | null> {
    return this.files.get(path) ?? null;
  }

  async remove(paths: readonly string[]): Promise<void> {
    for (const path of paths) {
      this.files.delete(path);
      this.removed.push(path);
    }
  }

  publicUrl(path: string): string {
    return `https://storage.test/public/${path}`;
  }

  reset(): void {
    this.files.clear();
    this.signed.length = 0;
    this.removed.length = 0;
  }
}
