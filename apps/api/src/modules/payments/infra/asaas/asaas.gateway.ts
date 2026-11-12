import type { PaymentGateway } from '../../application/payment-gateway.port.js';
import { PaymentProviderError, PixKeyNotFoundError } from '../../domain/payment-errors.js';
import type { PixKey, PixKeyOwner } from '../../domain/pix-key.js';
import type { AsaasHttpClient } from './asaas-http.client.js';

/** Resposta de GET /pix/addressKeys/external (só os campos que a Vitrine usa). */
interface AsaasPixKeyLookup {
  owner: { name: string; cpfCnpj: string };
}

// Adaptador do Asaas (ADR-0011, ADR-0012): traduz a porta PaymentGateway para a API v3.
// Valores: a Vitrine usa centavos; o Asaas usa reais com casas decimais.
export class AsaasGateway implements PaymentGateway {
  constructor(private readonly http: AsaasHttpClient) {}

  async lookupPixKey({ type, key }: PixKey): Promise<PixKeyOwner> {
    try {
      const found = await this.http.get<AsaasPixKeyLookup>('/pix/addressKeys/external', { type, key });
      return { name: found.owner.name, maskedDocument: found.owner.cpfCnpj };
    } catch (error) {
      // Chave inexistente: o Asaas responde 404 sem corpo.
      if (error instanceof PaymentProviderError && error.providerStatus === 404) throw new PixKeyNotFoundError();
      throw error;
    }
  }
}
