import { Get, HttpCode, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { z } from 'zod';

import { Audited } from '../../../shared/audit/audited.decorator.js';
import { AdminController } from '../../../shared/auth/roles.decorator.js';
import { ApiProblems, ApiZodResponse } from '../../../shared/openapi/openapi.js';
import { IdParam } from '../../../shared/validation/id-param.pipe.js';
import { ZodBody, ZodValidationPipe } from '../../../shared/validation/zod-validation.js';
import { DecideSellerUseCase } from '../application/decide-seller.use-case.js';
import { ListSellersUseCase } from '../application/list-sellers.use-case.js';
import { SetCommissionUseCase } from '../application/set-commission.use-case.js';
import { SELLER_STATUSES, type SellerStatus } from '../domain/seller.js';
import {
  type AdminSellerResponse,
  adminSellerSchema,
  type CommissionBody,
  commissionSchema,
  type DecisionReasonBody,
  decisionReasonSchema,
  sellerStatusQuerySchema,
  toAdminSeller,
} from './seller.dto.js';

// /v1/admin/sellers — só admin (404 para os demais, como toda a área de admin).
// Toda decisão é auditada com o antes e o depois (AC-051 a AC-054).
@AdminController('sellers')
export class AdminSellersController {
  constructor(
    private readonly listSellers: ListSellersUseCase,
    private readonly decideSeller: DecideSellerUseCase,
    private readonly setCommission: SetCommissionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lojas por situação', description: 'Da candidatura mais antiga para a mais nova, com o CPF/CNPJ completo.' })
  @ApiQuery({ name: 'status', enum: SELLER_STATUSES, required: true })
  @ApiZodResponse(200, z.array(adminSellerSchema))
  @ApiProblems(400)
  async list(@Query('status', new ZodValidationPipe(sellerStatusQuerySchema)) status: SellerStatus): Promise<AdminSellerResponse[]> {
    return (await this.listSellers.execute(status)).map(toAdminSeller);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Audited('seller.approve')
  @ApiOperation({ summary: 'Aprovar loja em análise', description: 'A dona ganha o papel seller na hora.' })
  @ApiZodResponse(200, adminSellerSchema)
  @ApiProblems(422)
  async approve(@IdParam() id: string): Promise<AdminSellerResponse> {
    return toAdminSeller(await this.decideSeller.execute(id, { kind: 'approve' }));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Audited('seller.reject')
  @ApiOperation({ summary: 'Rejeitar loja em análise', description: 'Exige o motivo; a pessoa pode tentar de novo após 7 dias.' })
  @ApiZodResponse(200, adminSellerSchema)
  @ApiProblems(400, 422)
  async reject(@IdParam() id: string, @ZodBody(decisionReasonSchema) body: DecisionReasonBody): Promise<AdminSellerResponse> {
    return toAdminSeller(await this.decideSeller.execute(id, { kind: 'reject', reason: body.reason }));
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @Audited('seller.suspend')
  @ApiOperation({ summary: 'Suspender loja aprovada', description: 'Exige o motivo. Nada é apagado.' })
  @ApiZodResponse(200, adminSellerSchema)
  @ApiProblems(400, 422)
  async suspend(@IdParam() id: string, @ZodBody(decisionReasonSchema) body: DecisionReasonBody): Promise<AdminSellerResponse> {
    return toAdminSeller(await this.decideSeller.execute(id, { kind: 'suspend', reason: body.reason }));
  }

  @Post(':id/reinstate')
  @HttpCode(200)
  @Audited('seller.reinstate')
  @ApiOperation({ summary: 'Reativar loja suspensa' })
  @ApiZodResponse(200, adminSellerSchema)
  @ApiProblems(422)
  async reinstate(@IdParam() id: string): Promise<AdminSellerResponse> {
    return toAdminSeller(await this.decideSeller.execute(id, { kind: 'reinstate' }));
  }

  @Patch(':id/commission')
  @Audited('seller.commission')
  @ApiOperation({ summary: 'Comissão da loja', description: 'Pontos-base (800 = 8%), ou null para voltar à padrão de 12%.' })
  @ApiZodResponse(200, adminSellerSchema)
  @ApiProblems(400)
  async commission(@IdParam() id: string, @ZodBody(commissionSchema) body: CommissionBody): Promise<AdminSellerResponse> {
    return toAdminSeller(await this.setCommission.execute(id, body.commissionBps));
  }
}
