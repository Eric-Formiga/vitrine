import { DomainError } from '../../../shared/errors/domain-error.js';

/** A API subiu sem as credenciais do provedor de pagamento. */
export class PaymentGatewayNotConfiguredError extends DomainError {
  readonly code = 'PAYMENT_GATEWAY_NOT_CONFIGURED';
  override readonly status = 503;

  constructor() {
    super('Pagamento indisponível: configure a ASAAS_API_KEY.');
  }
}

/** A chave Pix informada não existe no diretório do Pix. */
export class PixKeyNotFoundError extends DomainError {
  readonly code = 'PIX_KEY_NOT_FOUND';

  constructor() {
    super('Chave Pix não encontrada. Confira o tipo e a chave.');
  }
}

/** O titular da chave Pix não é a loja (o documento não bate). */
export class PixKeyOwnerMismatchError extends DomainError {
  readonly code = 'PIX_KEY_OWNER_MISMATCH';

  constructor() {
    super('Esta chave Pix não está no CPF/CNPJ da loja. Use uma chave da própria loja.');
  }
}

/** O provedor recusou o pedido ou falhou; a mensagem dele vai junto, sem dados sensíveis. */
export class PaymentProviderError extends DomainError {
  readonly code = 'PAYMENT_PROVIDER_ERROR';
  override readonly status = 502;

  constructor(
    readonly providerStatus: number,
    readonly providerMessages: string[],
  ) {
    super(`O provedor de pagamento respondeu ${providerStatus}: ${providerMessages.join('; ') || 'sem detalhes'}`);
  }
}
