import { ProductList } from '@/components/product-list';
import { loadMyProducts } from '@/lib/api/products';
import { serverApi } from '@/lib/api/server-fetch';

// "Meus produtos" (AC-082). O proxy já garante que só entra quem está logado; a API diz
// se a loja está aprovada (404 para quem não vende, 403 para a loja suspensa).
export default async function MeusProdutosPage() {
  const result = await loadMyProducts(await serverApi());

  if (result.kind === 'error') {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Meus produtos</h1>
        <p role="alert" className="text-muted-foreground">
          Não foi possível carregar os seus produtos: {result.message}
        </p>
      </section>
    );
  }

  return <ProductList products={result.kind === 'ok' ? result.products : []} approved={result.kind === 'ok'} />;
}
