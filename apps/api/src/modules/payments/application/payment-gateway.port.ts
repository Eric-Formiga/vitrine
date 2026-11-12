// Porta de pagamento (ADR-0011): os casos de uso falam com isto, nunca com o Asaas.
// Os tipos são da Vitrine (centavos, nomes em inglês do domínio), não os do provedor.

export interface SubaccountInput {
  /** Nome da loja (ou do titular). */
  name: string;
  email: string;
  /** CPF ou CNPJ, só dígitos. */
  cpfCnpj: string;
  /** Data de nascimento (AAAA-MM-DD), quando o documento é CPF. */
  birthDate?: string;
  /** Tipo da empresa, quando o documento é CNPJ. */
  companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';
  /** Celular com DDD, só dígitos. */
  mobilePhone: string;
  /** Faturamento mensal estimado, em centavos. */
  monthlyIncomeCents: number;
  address: {
    street: string;
    number: string;
    complement?: string;
    /** Bairro. */
    province: string;
    /** CEP, só dígitos. */
    postalCode: string;
  };
}

export interface Subaccount {
  id: string;
  /** Identificador da carteira: destino dos repasses. */
  walletId: string;
}

export interface PaymentGateway {
  /** Cria a subconta da loja ou devolve a que já existe com o mesmo e-mail. */
  createSubaccount(input: SubaccountInput): Promise<Subaccount>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
