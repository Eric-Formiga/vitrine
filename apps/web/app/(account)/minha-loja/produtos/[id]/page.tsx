import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/product-form';
import { loadLeafCategories, loadProductEditor, stepOf } from '@/lib/api/products';
import { publicApi } from '@/lib/api/public-client';
import { serverApi } from '@/lib/api/server-fetch';

import { publishAction, requestUploadAction, saveImagesAction, saveInfoAction, saveVariantsAction } from '../actions';

// Formulário de um produto (AC-083), na etapa de ?etapa=. Abre sempre na versão atual: a
// versão vai num campo oculto, e cada gravação a manda de volta (If-Match, AC-086).
export default async function ProdutoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [editor, categories] = await Promise.all([loadProductEditor(await serverApi(), id), loadLeafCategories(publicApi)]);

  if (editor.kind === 'not-found') notFound();
  if (editor.kind === 'error') {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Produto</h1>
        <p role="alert" className="text-muted-foreground">
          Não foi possível carregar o produto: {editor.message}
        </p>
      </section>
    );
  }

  return (
    <ProductForm
      step={stepOf(query.etapa)}
      product={editor.product}
      variants={editor.variants}
      images={editor.images}
      categories={categories}
      actions={{
        saveInfo: saveInfoAction,
        saveVariants: saveVariantsAction,
        saveImages: saveImagesAction,
        publish: publishAction,
        requestUpload: requestUploadAction,
      }}
    />
  );
}
