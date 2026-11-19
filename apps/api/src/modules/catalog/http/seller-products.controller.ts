import { Controller, Delete, Get, HttpCode, Inject, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';

import { Roles } from '../../../shared/auth/roles.decorator.js';
import { IfMatch, sendEtag } from '../../../shared/http/if-match.js';
import { ApiProblems, ApiZodResponse, SECURITY_SCHEME } from '../../../shared/openapi/openapi.js';
import { IdParam } from '../../../shared/validation/id-param.pipe.js';
import { ZodBody, ZodValidationPipe } from '../../../shared/validation/zod-validation.js';
import { STORAGE_GATEWAY, type StorageGateway } from '../../media/application/storage-gateway.port.js';
import { ApprovedSellerGuard, CurrentSeller } from '../../sellers/http/approved-seller.guard.js';
import type { Seller } from '../../sellers/domain/seller.js';
import { ArchiveProductUseCase } from '../application/archive-product.use-case.js';
import { CreateProductUseCase } from '../application/create-product.use-case.js';
import { ListMyProductsUseCase } from '../application/list-my-products.use-case.js';
import { PublishProductUseCase } from '../application/publish-product.use-case.js';
import { UpdateProductUseCase } from '../application/update-product.use-case.js';
import { PRODUCT_STATUSES, type ProductStatus } from '../domain/product.js';
import {
  type CreateProductBody,
  createProductSchema,
  productStatusQuerySchema,
  type SellerProductResponse,
  sellerProductSchema,
  type SellerProductSummaryResponse,
  sellerProductSummarySchema,
  toSellerProduct,
  toSellerProductSummary,
  type UpdateProductBody,
  updateProductSchema,
} from './product.dto.js';

const IF_MATCH = {
  name: 'If-Match',
  required: true,
  description: 'O ETag da versão que você está editando, ex.: "3". Desatualizado: 412; ausente: 428.',
};

// /v1/seller/products — produtos da loja aprovada (spec 03 H1). Sem o papel seller: 404;
// loja suspensa: 403 SELLER_NOT_ACTIVE. Toda escrita exige If-Match (AC-074, AC-075).
@Controller('seller/products')
@Roles('seller')
@UseGuards(ApprovedSellerGuard)
@ApiTags('vendedor')
@ApiBearerAuth(SECURITY_SCHEME)
@ApiProblems(401, 403, 404)
export class SellerProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly archiveProduct: ArchiveProductUseCase,
    private readonly publishProduct: PublishProductUseCase,
    private readonly myProducts: ListMyProductsUseCase,
    @Inject(STORAGE_GATEWAY) private readonly storage: StorageGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar produto (rascunho)', description: 'O slug vem do título, único na loja. Responde com o ETag.' })
  @ApiZodResponse(201, sellerProductSchema, 'Rascunho criado')
  @ApiProblems(400)
  async create(
    @CurrentSeller() seller: Seller,
    @ZodBody(createProductSchema) body: CreateProductBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SellerProductResponse> {
    const product = await this.createProduct.execute(seller.id, { ...body, description: body.description ?? '' });
    sendEtag(res, product.version);
    return toSellerProduct(product);
  }

  @Get()
  @ApiOperation({ summary: 'Meus produtos', description: 'Do mais recente para o mais antigo.' })
  @ApiQuery({ name: 'status', enum: PRODUCT_STATUSES, required: false })
  @ApiZodResponse(200, z.array(sellerProductSummarySchema))
  @ApiProblems(400)
  async list(
    @CurrentSeller() seller: Seller,
    @Query('status', new ZodValidationPipe(productStatusQuerySchema)) status: ProductStatus | undefined,
  ): Promise<SellerProductSummaryResponse[]> {
    const publicUrl = (path: string) => this.storage.publicUrl(path);
    return (await this.myProducts.list(seller.id, status)).map((summary) => toSellerProductSummary(summary, publicUrl));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Um produto meu', description: 'Responde com o ETag da versão atual.' })
  @ApiZodResponse(200, sellerProductSchema)
  async get(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SellerProductResponse> {
    const product = await this.myProducts.get(seller.id, id);
    sendEtag(res, product.version);
    return toSellerProduct(product);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar as informações', description: 'O slug não muda. 422 INVALID_STATE_TRANSITION se arquivado.' })
  @ApiHeader(IF_MATCH)
  @ApiZodResponse(200, sellerProductSchema)
  @ApiProblems(400, 412, 422, 428)
  async update(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @IfMatch() expectedVersion: number,
    @ZodBody(updateProductSchema) body: UpdateProductBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SellerProductResponse> {
    const product = await this.updateProduct.execute({ sellerId: seller.id, productId: id, expectedVersion }, body);
    sendEtag(res, product.version);
    return toSellerProduct(product);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Publicar',
    description:
      'Rascunho → ativo, com a data de publicação. Exige pelo menos uma foto e uma variante com estoque: ' +
      'senão 422 PRODUCT_NOT_PUBLISHABLE com `missing` (images, stock). Fora do rascunho: 422 INVALID_STATE_TRANSITION.',
  })
  @ApiHeader(IF_MATCH)
  @ApiZodResponse(200, sellerProductSchema)
  @ApiProblems(400, 412, 422, 428)
  async publish(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @IfMatch() expectedVersion: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SellerProductResponse> {
    const product = await this.publishProduct.execute({ sellerId: seller.id, productId: id, expectedVersion });
    sendEtag(res, product.version);
    return toSellerProduct(product);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Arquivar',
    description: 'Sai de cena sem ser apagado (RN-17), com as variantes e as imagens. É final.',
  })
  @ApiHeader(IF_MATCH)
  @ApiZodResponse(200, sellerProductSchema)
  @ApiProblems(400, 412, 422, 428)
  async archive(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @IfMatch() expectedVersion: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SellerProductResponse> {
    const product = await this.archiveProduct.execute({ sellerId: seller.id, productId: id, expectedVersion });
    sendEtag(res, product.version);
    return toSellerProduct(product);
  }
}
