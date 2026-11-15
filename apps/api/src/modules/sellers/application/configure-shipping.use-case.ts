import { Inject, Injectable } from '@nestjs/common';

import { RequestValidationError } from '../../../shared/errors/domain-error.js';
import { type ShippingSettings, shippingIssues } from '../domain/shipping.js';
import { ShippingNotConfiguredError } from '../domain/seller-errors.js';
import { SELLER_REPOSITORY, type SellerRepository } from './seller.repository.js';

// Frete da loja aprovada (AC-057): uma configuração por loja, substituída inteira a cada PUT.
@Injectable()
export class ConfigureShippingUseCase {
  constructor(@Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository) {}

  async get(sellerId: string): Promise<ShippingSettings> {
    const settings = await this.sellers.findShipping(sellerId);
    if (!settings) throw new ShippingNotConfiguredError();
    return settings;
  }

  save(sellerId: string, settings: ShippingSettings): Promise<ShippingSettings> {
    // A entrada já foi validada pelo DTO com a mesma regra; aqui ela protege quem chamar sem HTTP.
    const issues = shippingIssues(settings);
    if (issues.length) throw new RequestValidationError(issues);
    return this.sellers.saveShipping(sellerId, settings);
  }
}
