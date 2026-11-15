import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ApiProblems, ApiZodResponse, SECURITY_SCHEME } from '../../../shared/openapi/openapi.js';
import { ZodBody } from '../../../shared/validation/zod-validation.js';
import { CurrentUser, type CurrentUserData } from '../../identity/http/current-user.decorator.js';
import { ApplyForSellerUseCase } from '../application/apply-for-seller.use-case.js';
import { GetMyApplicationUseCase } from '../application/get-my-application.use-case.js';
import {
  type MyApplicationResponse,
  myApplicationSchema,
  type SellerApplicationBody,
  sellerApplicationSchema,
  toMyApplication,
} from './seller.dto.js';

// /v1/seller/application — qualquer pessoa logada se candidata e acompanha a própria
// loja. É a exceção da spec 01 H3: as outras rotas /seller/* exigem loja aprovada.
@Controller('seller/application')
@ApiTags('vendedor')
@ApiBearerAuth(SECURITY_SCHEME)
export class SellerApplicationController {
  constructor(
    private readonly applyForSeller: ApplyForSellerUseCase,
    private readonly getMyApplication: GetMyApplicationUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Candidatar-se a vender',
    description:
      'Confere no Asaas se o titular da chave Pix é o CPF/CNPJ da loja. Sem a conferência, nada é gravado: ' +
      '422 PIX_KEY_OWNER_MISMATCH ou PIX_KEY_NOT_FOUND; 503 PIX_KEY_CHECK_UNAVAILABLE se o Asaas não responder.',
  })
  @ApiZodResponse(201, myApplicationSchema, 'Loja criada em análise')
  @ApiProblems(400, 401, 409, 422, 503)
  async apply(
    @CurrentUser() user: CurrentUserData,
    @ZodBody(sellerApplicationSchema) body: SellerApplicationBody,
  ): Promise<MyApplicationResponse> {
    const seller = await this.applyForSeller.execute({ ...body, userId: user.id });
    return toMyApplication(seller, { store: true, pixKey: true, shipping: false });
  }

  @Get()
  @ApiOperation({ summary: 'Situação da minha loja', description: '404 se a pessoa ainda não se candidatou.' })
  @ApiZodResponse(200, myApplicationSchema)
  @ApiProblems(401, 404)
  async mine(@CurrentUser() user: CurrentUserData): Promise<MyApplicationResponse> {
    const { seller, checklist } = await this.getMyApplication.execute(user.id);
    return toMyApplication(seller, checklist);
  }
}
