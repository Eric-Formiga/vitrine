import { Inject, Injectable } from '@nestjs/common';

import { slugify } from '../../../shared/text/slugify.js';
import type { PixKey } from '../../payments/domain/pix-key.js';
import { applicationBlock, type Seller } from '../domain/seller.js';
import {
  DocumentTakenError,
  mainCategoryNotFound,
  SellerApplicationExistsError,
  SellerSlugTakenError,
  slugRequired,
} from '../domain/seller-errors.js';
import { taxIdDigits } from '../domain/tax-id.js';
import { DOCUMENT_VAULT, type DocumentVault } from './document-vault.port.js';
import { PixKeyVerifier } from './pix-key-verifier.js';
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
  constructor(
    @Inject(SELLER_REPOSITORY) private readonly sellers: SellerRepository,
    @Inject(DOCUMENT_VAULT) private readonly vault: DocumentVault,
    private readonly pixKeys: PixKeyVerifier,
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

    const pixKey = await this.pixKeys.verify(input.pixKey, document);
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
}
