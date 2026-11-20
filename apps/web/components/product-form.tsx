'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import {
  EMPTY_STEP_STATE,
  GAP_LABEL,
  type InfoField,
  type LeafCategory,
  type ProductImage,
  productUrl,
  publishGaps,
  type SellerProduct,
  type SellerVariant,
  type Step,
  STEP_LABEL,
  type StepState,
  STEPS,
} from '@/lib/api/products';
import { rowsFromVariants } from '@/lib/products/variant-grid';

import { ImageUploader, type RequestUpload } from './image-uploader';
import { STATUS_LABEL } from './product-list';
import { errorProps, FieldError, HiddenRef, inputClass, type StepAction, StepAlerts } from './product-form-parts';
import { VariantGridEditor } from './variant-grid-editor';

export interface ProductFormActions {
  saveInfo: StepAction;
  saveVariants: StepAction;
  saveImages: StepAction;
  publish: StepAction;
  requestUpload: RequestUpload;
}

const CONDITIONS = [
  { value: 'NEW', label: 'Novo' },
  { value: 'USED', label: 'Usado' },
] as const;

// Formulário de produto em etapas (AC-083): informações → variantes → imagens → revisão.
// Cada "Salvar e continuar" grava a etapa na API (a primeira cria o rascunho) com a versão
// do produto; os erros voltam junto ao campo, e o que foi digitado fica na tela.
export function ProductForm({
  step,
  product,
  variants,
  images,
  categories,
  actions,
  initialState = EMPTY_STEP_STATE,
}: {
  step: Step;
  product: SellerProduct | null;
  variants: SellerVariant[];
  images: ProductImage[];
  categories: LeafCategory[];
  actions: ProductFormActions;
  /** Estado inicial da etapa aberta (os testes passam erros e conflitos por aqui). */
  initialState?: StepState;
}) {
  // Sem produto, só a primeira etapa existe: ela cria o rascunho.
  const current: Step = product ? step : 'informacoes';
  const category = categories.find((option) => option.id === product?.categoryId);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link href="/minha-loja/produtos" className="text-sm text-muted-foreground hover:underline">
          ← Meus produtos
        </Link>
        <h1 className="text-2xl font-semibold">{product ? product.title : 'Novo produto'}</h1>
        {product ? (
          <p className="text-sm">
            Situação: <strong data-status={product.status}>{STATUS_LABEL[product.status]}</strong>
            {product.suspension ? <span className="text-muted-foreground"> — motivo: {product.suspension.reason}</span> : null}
          </p>
        ) : null}
        {product?.status === 'ARCHIVED' ? (
          <p role="status" className="text-sm text-muted-foreground">
            Produto arquivado: ele não muda mais.
          </p>
        ) : null}
      </header>

      <nav aria-label="Etapas">
        <ol className="flex flex-wrap gap-2 text-sm">
          {STEPS.map((item, index) => {
            const label = `${index + 1}. ${STEP_LABEL[item]}`;
            return (
              <li key={item}>
                {product && item !== current ? (
                  <Link href={productUrl(product.id, item)} className="rounded-md border border-border px-3 py-1 hover:bg-muted">
                    {label}
                  </Link>
                ) : (
                  <span
                    aria-current={item === current ? 'step' : undefined}
                    className={item === current ? 'rounded-md bg-primary px-3 py-1 text-primary-foreground' : 'px-3 py-1 text-muted-foreground'}
                  >
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {current === 'informacoes' ? (
        <InfoStep product={product} categories={categories} action={actions.saveInfo} initialState={initialState} />
      ) : null}
      {product && current === 'variantes' ? (
        category ? (
          <VariantGridEditor
            productId={product.id}
            version={product.version}
            sizeType={category.sizeType}
            initialRows={rowsFromVariants(variants)}
            action={actions.saveVariants}
            initialState={initialState}
          />
        ) : (
          <p role="alert">A categoria deste produto não está mais disponível. Escolha outra em Informações.</p>
        )
      ) : null}
      {product && current === 'imagens' ? (
        <ImageUploader
          productId={product.id}
          version={product.version}
          initialImages={images.map(({ path, url, alt, color }) => ({ path, url, alt, color }))}
          colors={[...new Set(variants.map((variant) => variant.color))]}
          action={actions.saveImages}
          requestUpload={actions.requestUpload}
          initialState={initialState}
        />
      ) : null}
      {product && current === 'revisao' ? (
        <ReviewStep product={product} variants={variants} images={images} action={actions.publish} initialState={initialState} />
      ) : null}
    </section>
  );
}

function InfoStep({
  product,
  categories,
  action,
  initialState,
}: {
  product: SellerProduct | null;
  categories: LeafCategory[];
  action: StepAction;
  initialState: StepState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  // Depois de um envio com erro, vale o que a pessoa digitou; antes, o que está gravado.
  const value = (field: InfoField): string => state.values[field] ?? (product ? String(product[field]) : '');
  const control = (field: InfoField) => ({ name: field, defaultValue: value(field), ...errorProps(state, field) });

  return (
    <form key={state.attempt} action={formAction} noValidate className="max-w-xl space-y-5">
      {product ? <HiddenRef productId={product.id} version={product.version} /> : null}
      <StepAlerts state={state} productId={product?.id ?? null} step="informacoes" />

      <div className="space-y-1.5">
        <label htmlFor="field-title" className="block text-sm font-medium">
          Título
        </label>
        <input type="text" required maxLength={120} className={inputClass} {...control('title')} />
        <FieldError state={state} field="title" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="field-description" className="block text-sm font-medium">
          Descrição
        </label>
        <textarea rows={6} maxLength={5000} className={inputClass} {...control('description')} />
        <FieldError state={state} field="description" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="field-categoryId" className="block text-sm font-medium">
          Categoria
        </label>
        <select required className={inputClass} {...control('categoryId')}>
          <option value="">Escolha a categoria</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError state={state} field="categoryId" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="field-condition" className="block text-sm font-medium">
          Condição
        </label>
        <select required className={inputClass} {...control('condition')}>
          <option value="">Escolha</option>
          {CONDITIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError state={state} field="condition" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Gravando...' : product ? 'Salvar e continuar' : 'Criar rascunho e continuar'}
      </Button>
    </form>
  );
}

function ReviewStep({
  product,
  variants,
  images,
  action,
  initialState,
}: {
  product: SellerProduct;
  variants: SellerVariant[];
  images: ProductImage[];
  action: StepAction;
  initialState: StepState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  // A API tem a última palavra (state.missing); antes de tentar, a mesma regra calculada aqui.
  const gaps = state.missing.length > 0 ? state.missing : publishGaps(images, variants);
  const stock = variants.reduce((sum, variant) => sum + variant.stock, 0);

  return (
    <div className="max-w-xl space-y-5">
      <dl className="grid grid-cols-[10rem_1fr] gap-y-2 rounded-md border border-border p-5 text-sm">
        <dt className="text-muted-foreground">Variantes</dt>
        <dd data-field="variants">{variants.length}</dd>
        <dt className="text-muted-foreground">Estoque total</dt>
        <dd data-field="stock">{stock}</dd>
        <dt className="text-muted-foreground">Fotos</dt>
        <dd data-field="images">{images.length}</dd>
      </dl>

      {product.status !== 'DRAFT' ? (
        <p role="status" className="text-sm">
          Este produto já saiu do rascunho ({STATUS_LABEL[product.status].toLowerCase()}).
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <HiddenRef productId={product.id} version={product.version} />
          {/* O que falta já aparece na lista abaixo; outro erro (ex.: API fora) vai para o topo. */}
          <StepAlerts state={state.missing.length > 0 ? { ...state, formError: null } : state} productId={product.id} step="revisao" />
          {gaps.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Falta para publicar:</p>
              <ul aria-label="Falta para publicar" className="list-disc space-y-1 pl-5 text-sm">
                {gaps.map((gap) => (
                  <li key={gap} data-gap={gap}>
                    {GAP_LABEL[gap]}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? 'Publicando...' : 'Publicar'}
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
