import type { PaymentGateway, Subaccount, SubaccountInput } from '../../application/payment-gateway.port.js';
import type { AsaasHttpClient } from './asaas-http.client.js';

/** Lista paginada do Asaas. */
interface AsaasList<T> {
  data: T[];
  hasMore: boolean;
}

interface AsaasAccount {
  id: string;
  walletId: string;
  email: string;
}

// Adaptador do Asaas (ADR-0011): traduz a porta PaymentGateway para a API v3.
// Valores: a Vitrine usa centavos; o Asaas usa reais com casas decimais.
export class AsaasGateway implements PaymentGateway {
  constructor(private readonly http: AsaasHttpClient) {}

  async createSubaccount(input: SubaccountInput): Promise<Subaccount> {
    // Procura antes de criar: repetir a aprovação de uma loja não gera outra subconta.
    const existing = await this.http.get<AsaasList<AsaasAccount>>('/accounts', { email: input.email, limit: 1 });
    const found = existing.data.find((account) => account.email.toLowerCase() === input.email.toLowerCase());
    if (found) return { id: found.id, walletId: found.walletId };

    // A resposta traz a chave de API da subconta (accessToken.apiKey); ela é descartada aqui.
    const created = await this.http.post<AsaasAccount>('/accounts', {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      birthDate: input.birthDate,
      companyType: input.companyType,
      mobilePhone: input.mobilePhone,
      incomeValue: toReais(input.monthlyIncomeCents),
      address: input.address.street,
      addressNumber: input.address.number,
      complement: input.address.complement,
      province: input.address.province,
      postalCode: input.address.postalCode,
    });
    return { id: created.id, walletId: created.walletId };
  }
}

function toReais(cents: number): number {
  return Math.round(cents) / 100;
}
