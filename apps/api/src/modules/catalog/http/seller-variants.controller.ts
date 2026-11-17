import { Controller, Get, Patch, Put, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Roles } from '../../../shared/auth/roles.decorator.js';
import { IfMatch, sendEtag } from '../../../shared/http/if-match.js';
import { ApiProblems, ApiZodResponse, SECURITY_SCHEME } from '../../../shared/openapi/openapi.js';
import { IdParam } from '../../../shared/validation/id-param.pipe.js';
import { ZodBody } from '../../../shared/validation/zod-validation.js';
import { ApprovedSellerGuard, CurrentSeller } from '../../sellers/http/approved-seller.guard.js';
import type { Seller } from '../../sellers/domain/seller.js';
import { AdjustStockUseCase } from '../application/adjust-stock.use-case.js';
import { ListVariantsUseCase, ReplaceVariantsUseCase } from '../application/replace-variants.use-case.js';
import {
  type SellerVariantGridResponse,
  sellerVariantGridSchema,
  type StockAdjustmentBody,
  stockAdjustmentSchema,
  toSellerVariantGrid,
  toStockChange,
  type VariantGridBody,
  variantGridSchema,
  type VariantStockResponse,
  variantStockSchema,
} from './variant.dto.js';

const IF_MATCH = {
  name: 'If-Match',
  required: true,
  description: 'O ETag da versão do produto que você está editando, ex.: "3". Desatualizado: 412; ausente: 428.',
};

// Grade de variantes (spec 03 H1) e ajuste rápido de estoque, na área da loja aprovada.
// A grade muda a versão do produto (If-Match); o ajuste de estoque não (AC-078).
@Controller('seller')
@Roles('seller')
@UseGuards(ApprovedSellerGuard)
@ApiTags('vendedor')
@ApiBearerAuth(SECURITY_SCHEME)
@ApiProblems(401, 403, 404)
export class SellerVariantsController {
  constructor(
    private readonly listVariants: ListVariantsUseCase,
    private readonly replaceVariants: ReplaceVariantsUseCase,
    private readonly adjustStock: AdjustStockUseCase,
  ) {}

  @Get('products/:id/variants')
  @ApiOperation({ summary: 'Grade de variantes', description: 'As ativas, com o ETag do produto.' })
  @ApiZodResponse(200, sellerVariantGridSchema)
  async list(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SellerVariantGridResponse> {
    const { product, variants } = await this.listVariants.execute(seller.id, id);
    sendEtag(res, product.version);
    return toSellerVariantGrid(variants);
  }

  @Put('products/:id/variants')
  @ApiOperation({
    summary: 'Trocar a grade de variantes',
    description:
      'A chave é tamanho + cor: quem continua mantém o id, quem sai é arquivada e quem volta é reativada. ' +
      'Recalcula o menor preço. 409 SKU_TAKEN se outra variante ativa da loja usa o SKU.',
  })
  @ApiHeader(IF_MATCH)
  @ApiZodResponse(200, sellerVariantGridSchema)
  @ApiProblems(400, 409, 412, 422, 428)
  async replace(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @IfMatch() expectedVersion: number,
    @ZodBody(variantGridSchema) body: VariantGridBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SellerVariantGridResponse> {
    const { product, variants } = await this.replaceVariants.execute(
      { sellerId: seller.id, productId: id, expectedVersion },
      body.variants,
    );
    sendEtag(res, product.version);
    return toSellerVariantGrid(variants);
  }

  @Patch('variants/:id/stock')
  @ApiOperation({
    summary: 'Ajustar o estoque',
    description:
      'Pela diferença (delta) ou pelo valor final (absolute). Sem If-Match e sem mudar a versão do produto. ' +
      '422 STOCK_WOULD_BE_NEGATIVE se ficaria abaixo de zero.',
  })
  @ApiZodResponse(200, variantStockSchema)
  @ApiProblems(400, 422)
  async adjust(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @ZodBody(stockAdjustmentSchema) body: StockAdjustmentBody,
  ): Promise<VariantStockResponse> {
    return { id, stock: await this.adjustStock.execute(seller.id, id, toStockChange(body)) };
  }
}
