import { Module } from '@nestjs/common';

import { ApplyForSellerUseCase } from './application/apply-for-seller.use-case.js';
import { DOCUMENT_VAULT } from './application/document-vault.port.js';
import { GetMyApplicationUseCase } from './application/get-my-application.use-case.js';
import { SELLER_REPOSITORY } from './application/seller.repository.js';
import { SellerApplicationController } from './http/seller-application.controller.js';
import { AesDocumentVault } from './infra/aes-document-vault.js';
import { PrismaSellerRepository } from './infra/prisma-seller.repository.js';

// Lojas (spec 02): candidatura com a chave Pix conferida no Asaas. A conferência usa a
// porta PaymentGateway, que o PaymentsModule oferece para a aplicação inteira.
@Module({
  controllers: [SellerApplicationController],
  providers: [
    ApplyForSellerUseCase,
    GetMyApplicationUseCase,
    { provide: SELLER_REPOSITORY, useClass: PrismaSellerRepository },
    { provide: DOCUMENT_VAULT, useClass: AesDocumentVault },
  ],
})
export class SellersModule {}
