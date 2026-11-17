import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../../shared/auth/roles.decorator.js';
import { ApiProblems, ApiZodResponse, SECURITY_SCHEME } from '../../../shared/openapi/openapi.js';
import { ZodBody } from '../../../shared/validation/zod-validation.js';
import { ApprovedSellerGuard, CurrentSeller } from '../../sellers/http/approved-seller.guard.js';
import type { Seller } from '../../sellers/domain/seller.js';
import { RequestUploadUseCase } from '../application/request-upload.use-case.js';
import { toUploadTicket, type UploadRequestBody, uploadRequestSchema, type UploadTicketResponse, uploadTicketSchema } from './upload.dto.js';

// /v1/seller/uploads — URL assinada para o navegador enviar uma foto direto ao Storage
// (spec 03 H2), na pasta da loja aprovada.
@Controller('seller/uploads')
@Roles('seller')
@UseGuards(ApprovedSellerGuard)
@ApiTags('vendedor')
@ApiBearerAuth(SECURITY_SCHEME)
@ApiProblems(401, 403, 404)
export class SellerUploadsController {
  constructor(private readonly requestUpload: RequestUploadUseCase) {}

  @Post()
  @ApiOperation({
    summary: 'Pedir uma URL de upload',
    description:
      'JPEG, PNG ou WebP de até 5 MB. O arquivo vai para sellers/{sellerId}/ com um nome aleatório. ' +
      'Sem uso num produto em 24 h, ele é apagado. 503 STORAGE_NOT_CONFIGURED sem o Supabase.',
  })
  @ApiZodResponse(201, uploadTicketSchema, 'URL assinada')
  @ApiProblems(400, 503)
  async create(@CurrentSeller() seller: Seller, @ZodBody(uploadRequestSchema) body: UploadRequestBody): Promise<UploadTicketResponse> {
    return toUploadTicket(await this.requestUpload.execute(seller.id, body));
  }
}
