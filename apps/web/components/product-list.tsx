import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { type ProductStatus, productUrl, type SellerProductSummary } from '@/lib/api/products';
import { formatReais } from '@/lib/products/variant-grid';

export const STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  ARCHIVED: 'Arquivado',
};

export const priceLabel = (cents: number | null) => (cents === null ? '—' : `R$ ${formatReais(cents)}`);

// "Meus produtos" (AC-082): capa, título, situação (com o motivo da suspensão), menor
// preço e estoque total. Sem produtos, o convite; sem loja aprovada, o aviso.
export function ProductList({ products, approved }: { products: SellerProductSummary[]; approved: boolean }) {
  if (!approved) {
    return (
      <section className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Meus produtos</h1>
        <p role="status" className="text-muted-foreground">
          Só a loja aprovada cadastra produtos. Acompanhe a situação da sua loja em{' '}
          <Link href="/minha-loja" className="font-medium text-primary underline">
            Minha loja
          </Link>
          .
        </p>
      </section>
    );
  }

  const novo = (
    <Button asChild>
      <Link href="/minha-loja/produtos/novo">Novo produto</Link>
    </Button>
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meus produtos</h1>
        {novo}
      </header>

      {products.length === 0 ? (
        <p className="text-muted-foreground">
          Você ainda não cadastrou nenhum produto. Comece pelo primeiro: título, grade de tamanhos e cores, fotos, e ele
          vai para a vitrine quando você publicar.
        </p>
      ) : (
        <ul aria-label="Produtos da loja" className="divide-y divide-border rounded-md border border-border">
          {products.map((product) => (
            <li key={product.id} data-product={product.id} className="flex items-center gap-4 p-4">
              {product.coverUrl ? (
                <img src={product.coverUrl} alt="" width={64} height={64} className="size-16 rounded object-cover" />
              ) : (
                <div aria-hidden="true" className="size-16 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <Link href={productUrl(product.id, 'informacoes')} className="font-medium hover:underline">
                  {product.title}
                </Link>
                <p className="text-sm">
                  <strong data-status={product.status}>{STATUS_LABEL[product.status]}</strong>
                  {product.suspension ? (
                    <span className="text-muted-foreground"> — motivo: {product.suspension.reason}</span>
                  ) : null}
                </p>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-3 text-right text-sm">
                <dt className="text-muted-foreground">A partir de</dt>
                <dd data-field="price">{priceLabel(product.minPriceCents)}</dd>
                <dt className="text-muted-foreground">Estoque</dt>
                <dd data-field="stock">{product.totalStock}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
