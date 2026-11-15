import type { PaymentGateway } from '../../src/modules/payments/application/payment-gateway.port.js';
import { PaymentProviderError, PixKeyNotFoundError } from '../../src/modules/payments/domain/payment-errors.js';
import type { PixKey, PixKeyOwner } from '../../src/modules/payments/domain/pix-key.js';
import type { PrismaService } from '../../src/shared/prisma/prisma.service.js';

// Kit dos testes de lojas: um "Asaas" falso para a conferência da chave Pix e dados prontos.

/** CPFs válidos de exemplo, de ninguém. */
export const CPF_ANA = '11144477735';
export const CPF_BRUNO = '52998224725';
export const CPF_CARLA = '39053344705';

/** Chaves Pix de teste e seus titulares, como o Asaas devolve (documento mascarado). */
export const CHAVE_DA_ANA: PixKey = { type: 'EMAIL', key: 'ana@atelie.dev.br' };
export const CHAVE_DO_BRUNO: PixKey = { type: 'PHONE', key: '11988887777' };
export const CHAVE_DA_CARLA: PixKey = { type: 'CPF', key: CPF_CARLA };
export const CHAVE_INEXISTENTE: PixKey = { type: 'EVP', key: '00000000-0000-0000-0000-000000000000' };

/**
 * Faz o papel do Asaas na consulta de titular de chave Pix. `down` imita o que o sandbox
 * respondeu em 14/11/2026 para qualquer chave: 400 "Ocorreu um erro desconhecido".
 */
export class FakePixDirectory implements Pick<PaymentGateway, 'lookupPixKey'> {
  calls: string[] = [];
  down = false;
  private readonly owners = new Map<string, PixKeyOwner>([
    [CHAVE_DA_ANA.key, { name: 'Ana Souza', maskedDocument: '***.444.777-**' }],
    [CHAVE_DO_BRUNO.key, { name: 'Bruno Lima', maskedDocument: '***.982.247-**' }],
    [CHAVE_DA_CARLA.key, { name: 'Carla Dias', maskedDocument: '***.533.447-**' }],
  ]);

  lookupPixKey(pixKey: PixKey): Promise<PixKeyOwner> {
    this.calls.push(`${pixKey.type} ${pixKey.key}`);
    if (this.down) {
      return Promise.reject(new PaymentProviderError(400, ['Ocorreu um erro desconhecido. Por favor, tente novamente.']));
    }
    const owner = this.owners.get(pixKey.key);
    return owner ? Promise.resolve(owner) : Promise.reject(new PixKeyNotFoundError());
  }

  asGateway(): PaymentGateway {
    return this as unknown as PaymentGateway;
  }
}

/** Categoria direto no banco (ativa ou arquivada), para a categoria principal da loja. */
export async function createCategory(prisma: PrismaService, slug: string, archived = false): Promise<string> {
  const category = await prisma.category.create({
    data: { name: slug, slug, sizeType: 'CLOTHING', archivedAt: archived ? new Date() : null },
  });
  return category.id;
}

/** Candidatura válida da Ana, para os testes mudarem só o que interessa. */
export function applicationOf(mainCategoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    storeName: 'Ateliê da Ana',
    bio: 'Roupas autorais feitas à mão em São Paulo.',
    document: '111.444.777-35',
    mainCategoryId,
    instagram: '@atelie.da.ana',
    pixKey: CHAVE_DA_ANA,
    ...overrides,
  };
}
