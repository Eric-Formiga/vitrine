import type { SizeType } from '../../src/modules/catalog/domain/category.js';
import { DOCUMENT_VAULT, type DocumentVault } from '../../src/modules/sellers/application/document-vault.port.js';
import { createPerson, type TestApp, type TestPerson } from './admin-test-kit.js';

// Kit dos testes de produtos: lojas e categorias direto no banco, para cada teste
// começar do ponto que interessa (a candidatura e a aprovação já têm os testes delas).

export interface TestStore extends TestPerson {
  sellerId: string;
}

/** Categoria direto no banco. Sem `parentId`, fica no primeiro nível. */
export async function createCategory(
  prisma: TestApp['prisma'],
  slug: string,
  { parentId = null, sizeType = 'CLOTHING', archived = false }: { parentId?: string | null; sizeType?: SizeType; archived?: boolean } = {},
): Promise<string> {
  const category = await prisma.category.create({
    data: { name: slug, slug, parentId, sizeType, archivedAt: archived ? new Date() : null },
  });
  return category.id;
}

let nextDocument = 0;

/** Pessoa com o papel seller e uma loja na situação pedida (aprovada, por padrão). */
export async function createStore(
  { app, prisma }: TestApp,
  name: string,
  categoryId: string,
  status: 'APPROVED' | 'SUSPENDED' | 'PENDING' = 'APPROVED',
): Promise<TestStore> {
  const roles = status === 'PENDING' ? ['customer'] : ['customer', 'seller'];
  const person = await createPerson(prisma, name, roles);
  const slug = `loja-${name.toLowerCase()}`;
  // O documento passa pelo cofre da própria API: a loja é lida (e decifrada) a cada requisição.
  const vault = app.get<DocumentVault>(DOCUMENT_VAULT, { strict: false });
  const document = vault.seal(String(++nextDocument).padStart(11, '0'));
  const seller = await prisma.seller.create({
    data: {
      userId: person.id,
      storeName: `Loja ${name}`,
      slug,
      bio: 'Loja de teste da Vitrine.',
      mainCategoryId: categoryId,
      documentEncrypted: document.encrypted,
      documentHash: document.hash,
      status,
      pixKeyType: 'EMAIL',
      pixKey: `${slug}@exemplo.com`,
      pixKeyOwnerName: name,
      pixKeyOwnerDocument: '***.000.000-**',
      pixKeyVerifiedAt: new Date(),
      approvedAt: status === 'PENDING' ? null : new Date(),
      suspendedAt: status === 'SUSPENDED' ? new Date() : null,
      suspensionReason: status === 'SUSPENDED' ? 'Teste.' : null,
    },
  });
  return { ...person, sellerId: seller.id };
}

/** Informações válidas de um produto, para os testes mudarem só o que interessa. */
export function productOf(categoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    title: 'Vestido Midi de Linho',
    description: 'Linho lavado, forro de algodão.\nModelagem soltinha.',
    categoryId,
    condition: 'NEW',
    ...overrides,
  };
}

/** Variante direto no banco (a grade pela API é da T-021). */
export async function insertVariant(
  prisma: TestApp['prisma'],
  store: TestStore,
  productId: string,
  { size, color = 'Preto', stock = 5, priceCents = 19900, archived = false }: {
    size: string;
    color?: string;
    stock?: number;
    priceCents?: number;
    archived?: boolean;
  },
): Promise<void> {
  await prisma.productVariant.create({
    data: {
      productId,
      sellerId: store.sellerId,
      sku: `${productId.slice(0, 8)}-${size}-${color}`.toUpperCase(),
      size,
      color,
      colorHex: '#000000',
      priceCents,
      stock,
      weightGrams: 300,
      archivedAt: archived ? new Date() : null,
    },
  });
}
