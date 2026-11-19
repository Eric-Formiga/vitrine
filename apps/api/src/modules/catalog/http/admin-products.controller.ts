import { HttpCode, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { Audited } from '../../../shared/audit/audited.decorator.js';
import { AdminController } from '../../../shared/auth/roles.decorator.js';
import { ApiProblems, ApiZodResponse } from '../../../shared/openapi/openapi.js';
import { IdParam } from '../../../shared/validation/id-param.pipe.js';
import { ZodBody } from '../../../shared/validation/zod-validation.js';
import { type DecisionReasonBody, decisionReasonSchema } from '../../sellers/http/seller.dto.js';
import { ModerateProductUseCase } from '../application/moderate-product.use-case.js';
import { type AdminProductResponse, adminProductSchema, toAdminProduct } from './product.dto.js';

// /v1/admin/products — moderação (spec 03 H5). Só admin (404 para os demais). Sem If-Match,
// mas cada decisão sobe a versão do produto e vai para a trilha de auditoria (AC-079).
@AdminController('products')
export class AdminProductsController {
  constructor(private readonly moderate: ModerateProductUseCase) {}

  @Post(':id/suspend')
  @HttpCode(200)
  @Audited('product.suspend')
  @ApiOperation({
    summary: 'Suspender produto ativo',
    description: 'Exige o motivo, mostrado ao vendedor. O produto sai da vitrine; nada é apagado.',
  })
  @ApiZodResponse(200, adminProductSchema)
  @ApiProblems(400, 422)
  async suspend(@IdParam() id: string, @ZodBody(decisionReasonSchema) body: DecisionReasonBody): Promise<AdminProductResponse> {
    return toAdminProduct(await this.moderate.suspend(id, body.reason));
  }

  @Post(':id/reinstate')
  @HttpCode(200)
  @Audited('product.reinstate')
  @ApiOperation({ summary: 'Reativar produto suspenso', description: 'Volta a ativo, com a data da primeira publicação.' })
  @ApiZodResponse(200, adminProductSchema)
  @ApiProblems(422)
  async reinstate(@IdParam() id: string): Promise<AdminProductResponse> {
    return toAdminProduct(await this.moderate.reinstate(id));
  }
}
