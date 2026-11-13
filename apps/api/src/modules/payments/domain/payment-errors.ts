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

/** A operadora do cartão recusou a cobrança. A mensagem do provedor vai junto. */
export class PaymentDeclinedError extends DomainError {
  readonly code = 'PAYMENT_DECLINED';
  override readonly status = 402;

  constructor(readonly providerMessages: string[]) {
    super(`Pagamento recusado: ${providerMessages.join('; ') || 'a operadora não autorizou a cobrança'}.`);
  }
}

/**
 * O provedor recusou o estorno: valor acima do que sobrou na cobrança, cobrança que não
 * pode ser estornada, ou estorno pedido cedo demais (logo após o recebimento).
 */
export class RefundNotAllowedError extends DomainError {
  readonly code = 'REFUND_NOT_ALLOWED';

  constructor(readonly providerMessages: string[]) {
    super(`Estorno recusado: ${providerMessages.join('; ') || 'o provedor não permitiu o estorno'}.`);
  }
}

/**
 * O provedor recusou a transferência por parecer repetida: já existe uma transferência
 * de mesmo valor para a mesma chave Pix no mesmo dia (Asaas: 409 checkout.already.requested),
 * mesmo com outra referência.
 */
export class PixTransferDuplicateError extends DomainError {
  readonly code = 'PIX_TRANSFER_DUPLICATE';
  override readonly status = 409;

  constructor(readonly providerMessages: string[]) {
    super(`Transferência recusada como repetida: ${providerMessages.join('; ') || 'mesmo valor e mesma chave no mesmo dia'}.`);
  }
}

/** O provedor recusou o pedido ou falhou; a mensagem dele vai junto, sem dados sensíveis. */
export class PaymentProviderError extends DomainError {
  readonly code = 'PAYMENT_PROVIDER_ERROR';
  override readonly status = 502;

  constructor(
    readonly providerStatus: number,
    readonly providerMessages: string[],
    /** Códigos do provedor (ex.: "invalid_creditCard"), para o adaptador traduzir recusas conhecidas. */
    readonly providerCodes: string[] = [],
  ) {
    super(`O provedor de pagamento respondeu ${providerStatus}: ${providerMessages.join('; ') || 'sem detalhes'}`);
  }
}
