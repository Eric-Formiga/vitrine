import { Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Audited } from '../../../shared/audit/audited.decorator.js';
import { Roles } from '../../../shared/auth/roles.decorator.js';
import { ApiProblems, ApiZodResponse, SECURITY_SCHEME } from '../../../shared/openapi/openapi.js';
import { ZodBody } from '../../../shared/validation/zod-validation.js';
import { ChangePixKeyUseCase } from '../application/change-pix-key.use-case.js';
import { ConfigureShippingUseCase } from '../application/configure-shipping.use-case.js';
import type { Seller } from '../domain/seller.js';
import type { ShippingSettings } from '../domain/shipping.js';
import { ApprovedSellerGuard, CurrentSeller } from './approved-seller.guard.js';
import {
  type PixKeyBody,
  pixKeySchema,
  type ShippingSettingsBody,
  shippingSettingsInputSchema,
  shippingSettingsSchema,
  toVerifiedPixKey,
  type VerifiedPixKeyResponse,
  verifiedPixKeySchema,
} from './seller.dto.js';

// /v1/seller/* — área da loja aprovada (spec 01 H3, AC-055): sem o papel seller, 404;
// loja suspensa, 403 SELLER_NOT_ACTIVE. A candidatura (/seller/application) fica fora daqui.
@Controller('seller')
@Roles('seller')
@UseGuards(ApprovedSellerGuard)
@ApiTags('vendedor')
@ApiBearerAuth(SECURITY_SCHEME)
@ApiProblems(401, 403, 404)
export class SellerAreaController {
  constructor(
    private readonly changePixKey: ChangePixKeyUseCase,
    private readonly shipping: ConfigureShippingUseCase,
  ) {}

  @Get('pix-key')
  @ApiOperation({ summary: 'Chave Pix de recebimento', description: 'Com o titular conferido no Asaas.' })
  @ApiZodResponse(200, verifiedPixKeySchema)
  pixKey(@CurrentSeller() seller: Seller): VerifiedPixKeyResponse {
    return toVerifiedPixKey(seller.pixKey);
  }

  @Put('pix-key')
  @Audited('seller.pix_key_change')
  @ApiOperation({
    summary: 'Trocar a chave Pix',
    description:
      'Confere o titular no Asaas, como na candidatura. Se falhar, a chave antiga continua: ' +
      '422 PIX_KEY_OWNER_MISMATCH ou PIX_KEY_NOT_FOUND; 503 PIX_KEY_CHECK_UNAVAILABLE.',
  })
  @ApiZodResponse(200, verifiedPixKeySchema)
  @ApiProblems(400, 422, 503)
  async replacePixKey(@CurrentSeller() seller: Seller, @ZodBody(pixKeySchema) body: PixKeyBody): Promise<VerifiedPixKeyResponse> {
    return toVerifiedPixKey(await this.changePixKey.execute(seller, body));
  }

  @Get('shipping')
  @ApiOperation({ summary: 'Configuração de frete', description: '404 SHIPPING_NOT_CONFIGURED se ainda não foi feita.' })
  @ApiZodResponse(200, shippingSettingsSchema)
  shippingSettings(@CurrentSeller() seller: Seller): Promise<ShippingSettings> {
    return this.shipping.get(seller.id);
  }

  @Put('shipping')
  @ApiOperation({ summary: 'Configurar o frete', description: 'Substitui a configuração inteira.' })
  @ApiZodResponse(200, shippingSettingsSchema)
  @ApiProblems(400)
  configureShipping(
    @CurrentSeller() seller: Seller,
    @ZodBody(shippingSettingsInputSchema) body: ShippingSettingsBody,
  ): Promise<ShippingSettings> {
    return this.shipping.save(seller.id, body);
  }
}
