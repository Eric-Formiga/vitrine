import { ProductForm } from '@/components/product-form';
import { loadLeafCategories } from '@/lib/api/products';
import { publicApi } from '@/lib/api/public-client';

import { publishAction, requestUploadAction, saveImagesAction, saveInfoAction, saveVariantsAction } from '../actions';

// Novo produto (AC-083): a primeira etapa cria o rascunho e leva para /minha-loja/produtos/{id}.
export default async function NovoProdutoPage() {
  const categories = await loadLeafCategories(publicApi);
  return (
    <ProductForm
      step="informacoes"
      product={null}
      variants={[]}
      images={[]}
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
