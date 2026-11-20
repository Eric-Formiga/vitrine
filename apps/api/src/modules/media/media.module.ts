import { type DynamicModule, Module } from '@nestjs/common';

import { ENV } from '../../shared/config/config.module.js';
import type { Env } from '../../shared/config/env.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { CleanOrphanUploadsJob, CleanOrphanUploadsUseCase } from './application/clean-orphan-uploads.use-case.js';
import { RequestUploadUseCase } from './application/request-upload.use-case.js';
import { STORAGE_GATEWAY, type StorageGateway } from './application/storage-gateway.port.js';
import { UPLOAD_REPOSITORY } from './application/upload.repository.js';
import { SellerUploadsController } from './http/seller-uploads.controller.js';
import { PrismaUploadRepository } from './infra/prisma-upload.repository.js';
import { SupabaseStorageGateway } from './infra/supabase-storage.gateway.js';

export interface MediaModuleOptions {
  /** Substitui o Supabase Storage (usado pelos testes). */
  storageGateway?: StorageGateway;
}

// Arquivos (ADR-0004): o adaptador do Supabase Storage atrás da porta StorageGateway, a
// URL de upload do vendedor e a limpeza de hora em hora dos arquivos sem uso (US-030).
// Global: o catálogo usa a porta nas imagens dos produtos.
@Module({})
export class MediaModule {
  static forRoot({ storageGateway }: MediaModuleOptions = {}): DynamicModule {
    return {
      module: MediaModule,
      global: true,
      imports: [SellersModule],
      controllers: [SellerUploadsController],
      providers: [
        storageGateway
          ? { provide: STORAGE_GATEWAY, useValue: storageGateway }
          : {
              provide: STORAGE_GATEWAY,
              inject: [ENV],
              useFactory: (env: Env) =>
                new SupabaseStorageGateway({
                  url: env.SUPABASE_URL,
                  secretKey: env.SUPABASE_SECRET_KEY,
                  bucket: env.SUPABASE_STORAGE_BUCKET,
                }),
            },
        { provide: UPLOAD_REPOSITORY, useClass: PrismaUploadRepository },
        RequestUploadUseCase,
        CleanOrphanUploadsUseCase,
        CleanOrphanUploadsJob,
      ],
      exports: [STORAGE_GATEWAY],
    };
  }
}
