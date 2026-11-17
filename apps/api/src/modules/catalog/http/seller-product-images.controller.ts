import { Controller, Get, Inject, Put, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Roles } from '../../../shared/auth/roles.decorator.js';
import { IfMatch, sendEtag } from '../../../shared/http/if-match.js';
import { ApiProblems, ApiZodResponse, SECURITY_SCHEME } from '../../../shared/openapi/openapi.js';
import { IdParam } from '../../../shared/validation/id-param.pipe.js';
import { ZodBody } from '../../../shared/validation/zod-validation.js';
import { STORAGE_GATEWAY, type StorageGateway } from '../../media/application/storage-gateway.port.js';
import { ApprovedSellerGuard, CurrentSeller } from '../../sellers/http/approved-seller.guard.js';
import type { Seller } from '../../sellers/domain/seller.js';
import { ListImagesUseCase, ReplaceImagesUseCase } from '../application/replace-images.use-case.js';
import {
  type ProductImageListResponse,
  productImageListSchema,
  type ProductImagesBody,
  productImagesSchema,
  toProductImageList,
} from './product-image.dto.js';

// Fotos do produto (spec 03 H2). A troca muda a versão do produto, como a grade.
@Controller('seller/products/:id/images')
@Roles('seller')
@UseGuards(ApprovedSellerGuard)
@ApiTags('vendedor')
@ApiBearerAuth(SECURITY_SCHEME)
@ApiProblems(401, 403, 404)
export class SellerProductImagesController {
  constructor(
    private readonly listImages: ListImagesUseCase,
    private readonly replaceImages: ReplaceImagesUseCase,
    @Inject(STORAGE_GATEWAY) private readonly storage: StorageGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Fotos do produto', description: 'Na ordem (a primeira é a capa), com o ETag do produto.' })
  @ApiZodResponse(200, productImageListSchema)
  async list(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProductImageListResponse> {
    const { product, images } = await this.listImages.execute(seller.id, id);
    sendEtag(res, product.version);
    return toProductImageList(images, (path) => this.storage.publicUrl(path));
  }

  @Put()
  @ApiOperation({
    summary: 'Trocar as fotos',
    description:
      'De 0 a 8, já enviadas pela URL de upload. Cada arquivo é conferido no Storage (tipo e tamanho reais). ' +
      '422 INVALID_IMAGE com `position` e `reason`. As que saíram vão para a limpeza.',
  })
  @ApiHeader({
    name: 'If-Match',
    required: true,
    description: 'O ETag da versão do produto que você está editando, ex.: "3". Desatualizado: 412; ausente: 428.',
  })
  @ApiZodResponse(200, productImageListSchema)
  @ApiProblems(400, 412, 422, 428, 503)
  async replace(
    @CurrentSeller() seller: Seller,
    @IdParam() id: string,
    @IfMatch() expectedVersion: number,
    @ZodBody(productImagesSchema) body: ProductImagesBody,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProductImageListResponse> {
    const { product, images } = await this.replaceImages.execute(
      { sellerId: seller.id, productId: id, expectedVersion },
      body.images,
    );
    sendEtag(res, product.version);
    return toProductImageList(images, (path) => this.storage.publicUrl(path));
  }
}
