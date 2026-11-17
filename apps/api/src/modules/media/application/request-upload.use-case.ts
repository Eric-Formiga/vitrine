import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { type ImageType, uploadPath } from '../domain/upload.js';
import { STORAGE_GATEWAY, type SignedUpload, type StorageGateway } from './storage-gateway.port.js';
import { UPLOAD_REPOSITORY, type UploadRepository } from './upload.repository.js';

export interface UploadTicket extends SignedUpload {
  /** Onde o arquivo vai ficar; é o que o site manda depois na lista de imagens. */
  path: string;
}

// AC-067: o navegador envia a foto direto ao Storage, sem passar pela API. O tipo e o
// tamanho declarados já chegam validados pelo formato da entrada.
@Injectable()
export class RequestUploadUseCase {
  constructor(
    @Inject(STORAGE_GATEWAY) private readonly storage: StorageGateway,
    @Inject(UPLOAD_REPOSITORY) private readonly uploads: UploadRepository,
  ) {}

  async execute(sellerId: string, file: { contentType: ImageType; sizeBytes: number }): Promise<UploadTicket> {
    const path = uploadPath(sellerId, file.contentType, randomUUID());
    // Assina antes de registrar: com o Storage fora, nada fica gravado à toa.
    const signed = await this.storage.createSignedUpload(path);
    await this.uploads.create({ path, sellerId, ...file });
    return { path, ...signed };
  }
}
