import { Module } from '@nestjs/common';

import { ApplyForSellerUseCase } from './application/apply-for-seller.use-case.js';
import { DecideSellerUseCase } from './application/decide-seller.use-case.js';
import { DOCUMENT_VAULT } from './application/document-vault.port.js';
import { GetMyApplicationUseCase } from './application/get-my-application.use-case.js';
import { ListSellersUseCase } from './application/list-sellers.use-case.js';
import { SELLER_REPOSITORY } from './application/seller.repository.js';
import { SetCommissionUseCase } from './application/set-commission.use-case.js';
import { AdminSellersController } from './http/admin-sellers.controller.js';
import { SellerApplicationController } from './http/seller-application.controller.js';
import { AesDocumentVault } from './infra/aes-document-vault.js';
import { PrismaSellerRepository } from './infra/prisma-seller.repository.js';

// Lojas (spec 02): candidatura com a chave Pix conferida no Asaas e as decisões do admin.
// A conferência usa a porta PaymentGateway (PaymentsModule) e o papel `seller` vem do
// UserRolesService (IdentityModule); os dois são globais.
@Module({
  controllers: [SellerApplicationController, AdminSellersController],
  providers: [
    ApplyForSellerUseCase,
    GetMyApplicationUseCase,
    ListSellersUseCase,
    DecideSellerUseCase,
    SetCommissionUseCase,
    { provide: SELLER_REPOSITORY, useClass: PrismaSellerRepository },
    { provide: DOCUMENT_VAULT, useClass: AesDocumentVault },
  ],
})
export class SellersModule {}
