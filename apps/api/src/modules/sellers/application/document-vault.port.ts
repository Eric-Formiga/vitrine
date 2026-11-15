// Guarda do CPF/CNPJ das lojas (ASM-016). O caso de uso só conhece esta porta.
export interface SealedDocument {
  /** Cifrado, para guardar e ler de volta. */
  encrypted: string;
  /** Sempre igual para o mesmo documento: é o que o índice único usa (uma loja por documento). */
  hash: string;
}

export interface DocumentVault {
  /** Recebe só os dígitos. */
  seal(digits: string): SealedDocument;
  hash(digits: string): string;
  open(encrypted: string): string;
}

export const DOCUMENT_VAULT = Symbol('DOCUMENT_VAULT');
