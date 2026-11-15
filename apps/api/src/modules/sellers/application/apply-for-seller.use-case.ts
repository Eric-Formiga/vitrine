import { Inject, Injectable, Logger } from '@nestjs/common';

import { slugify } from '../../../shared/text/slugify.js';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../../payments/application/payment-gateway.port.js';
import { PixKeyNotFoundError } from '../../payments/domain/payment-errors.js';
import { assertPixKeyOwner, type PixKey } from '../../payments/domain/pix-key.js';
import { applicationBlock, type Seller, type VerifiedPixKey } from '../domain/seller.js';
import {
  DocumentTakenError,
  mainCategoryNotFound,
  PixKeyCheckUnavailableError,
  SellerApplicationExistsError,
  SellerSlugTakenError,
  slugRequired,
} from '../domain/seller-errors.js';
import { taxIdDigits } from '../domain/tax-id.js';
import { DOCUMENT_VAULT, type DocumentVault } from './document-vault.port.js';
import { SELLER_REPOSITORY, type SellerRepository } from './seller.repository.js';

export interface SellerApplicationInput {
  userId: string;
  storeName: string;
  /** Omitido: gerado do nome. */
  slug?: string;
  bio: string;
  /** CPF/CNPJ já com os dígitos verificadores conferidos (validação de entrada). */
  document: string;
  mainCategoryId: string;
  instagram?: string | null;
  pixKey: PixKey;
}

// Candidatura de loja (spec 02 H1, AC-043 a AC-048). A ordem importa: primeiro o que é
// barato e local (conta, categoria, slug, documento); só depois a consulta ao Asaas, que
// é externa e pode falhar. Nada é gravado sem a chave Pix conferida (Q-007).
@Injectable()
export class ApplyForSellerUseCase {
  private readonly logger = new Logger('Candidaturas');

  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository,
    @Inject(DOCUMENT_VAULT) private readonly vault: DocumentVault,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async execute(input: SellerApplicationInput): Promise<Seller> {
    const existing = await this.sellers.findByUserId(input.userId);
    const block = applicationBlock(existing, new Date());
    if (block.blocked) throw new SellerApplicationExistsError(block.until);

    if (!(await this.sellers.isActiveCategory(input.mainCategoryId))) throw mainCategoryNotFound();

    const slug = input.slug ?? slugify(input.storeName);
    if (!slug) throw slugRequired();

    const document = taxIdDigits(input.document);
    const conflicts = await this.sellers.findConflicts({
      slug,
      documentHash: this.vault.hash(document),
      exceptUserId: input.userId,
    });
    if (conflicts.documentTaken) throw new DocumentTakenError();
    if (conflicts.slugTaken) throw new SellerSlugTakenError(slug);

    const pixKey = await this.verifyPixKey(input.pixKey, document);
    const data = {
      userId: input.userId,
      storeName: input.storeName,
      slug,
      bio: input.bio,
      instagram: input.instagram ?? null,
      mainCategoryId: input.mainCategoryId,
      document,
      pixKey,
    };
    return existing ? this.sellers.reapply(existing.id, data) : this.sellers.createApplication(data);
  }

  /**
   * Consulta o titular no Asaas e confere com o documento da loja (ADR-0012). Chave
   * inexistente e titular diferente passam como estão (422); qualquer outra falha do
   * provedor vira "tente depois" (503), sem gravar nada.
   */
  async verifyPixKey(pixKey: PixKey, document: string): Promise<VerifiedPixKey> {
    let owner;
    try {
      owner = await this.gateway.lookupPixKey(pixKey);
    } catch (error) {
      if (error instanceof PixKeyNotFoundError) throw error;
      this.logger.warn({ err: error, msg: 'conferência de chave Pix indisponível' });
      throw new PixKeyCheckUnavailableError();
    }
    assertPixKeyOwner(owner, document);
    return { ...pixKey, ownerName: owner.name, ownerDocument: owner.maskedDocument, verifiedAt: new Date() };
  }
}
