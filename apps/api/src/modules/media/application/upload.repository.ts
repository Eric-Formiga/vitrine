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
}

export const UPLOAD_REPOSITORY = Symbol('UPLOAD_REPOSITORY');
