import type { ImageType } from '../domain/upload.js';

export interface NewUpload {
  path: string;
  sellerId: string;
  contentType: ImageType;
  /** O tamanho declarado pelo navegador; o real é conferido no Storage ao usar o arquivo. */
  sizeBytes: number;
}

// Porta: os casos de uso dependem disto, não do Prisma.
export interface UploadRepository {
  /** Registra o arquivo prometido: sem uso em 24 h, a limpeza (US-030) o apaga. */
  create(upload: NewUpload): Promise<void>;
  /**
   * Até `limit` arquivos órfãos (US-030): sem foto de produto que os use e, antes de
   * `cutoff`, criados (nunca usados) ou desligados de um produto. Os mais antigos primeiro.
   */
  findOrphans(cutoff: Date, limit: number): Promise<string[]>;
  /** Apaga o registro dos arquivos que o Storage já apagou (os que voltaram a ser usados ficam). */
  deleteOrphans(paths: readonly string[]): Promise<void>;
}

export const UPLOAD_REPOSITORY = Symbol('UPLOAD_REPOSITORY');
