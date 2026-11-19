import type { ApiClient, Schemas } from '@vitrine/api-client';

import { type GridRow, type SizeType, toVariantInputs } from '@/lib/products/variant-grid';

// Regras das telas de produtos do vendedor (US-031): carregar a lista e o formulário,
// gravar cada etapa com a versão do produto (If-Match) e transformar os erros da API em
// mensagens por campo. Recebem o cliente tipado: o site passa o `serverApi`, os testes
// passam uma API de mentira.

export type SellerProduct = Schemas['SellerProduct'];
export type SellerProductSummary = Schemas['SellerProductSummary'];
export type SellerVariant = Schemas['SellerVariant'];
export type ProductImage = Schemas['ProductImage'];
export type ProductStatus = SellerProduct['status'];
export type ProductCondition = SellerProduct['condition'];
/** O que falta para publicar (PRODUCT_NOT_PUBLISHABLE, `missing`). */
export type PublishGap = 'images' | 'stock' | 'variants';

type Problem = Partial<Schemas['ProblemDetails']> & {
  currentVersion?: number;
  missing?: PublishGap[];
  position?: number;
};

// ── Etapas ──────────────────────────────────────────────────────────────────

export const STEPS = ['informacoes', 'variantes', 'imagens', 'revisao'] as const;
export type Step = (typeof STEPS)[number];

export const STEP_LABEL: Record<Step, string> = {
  informacoes: 'Informações',
  variantes: 'Variantes',
  imagens: 'Imagens',
  revisao: 'Revisão',
};

export function stepOf(param: string | string[] | undefined): Step {
  return STEPS.find((step) => step === param) ?? 'informacoes';
}

export function nextStep(step: Step): Step {
  return STEPS[Math.min(STEPS.indexOf(step) + 1, STEPS.length - 1)] ?? 'revisao';
}

export const productUrl = (id: string, step: Step) => `/minha-loja/produtos/${id}?etapa=${step}`;

export const GAP_LABEL: Record<PublishGap, string> = {
  images: 'Envie pelo menos uma foto.',
  stock: 'Deixe pelo menos uma variante com estoque.',
  variants: 'Monte a grade com pelo menos uma variante.',
};

/** O que falta para publicar, pela mesma regra da API: foto e variante com estoque. */
export function publishGaps(images: readonly unknown[], variants: readonly Pick<SellerVariant, 'stock'>[]): PublishGap[] {
  const gaps: PublishGap[] = [];
  if (images.length === 0) gaps.push('images');
  if (!variants.some((variant) => variant.stock > 0)) gaps.push('stock');
  return gaps;
}

// ── Estado de uma etapa ───────────────────────────────────────────────────────

export const INFO_FIELDS = ['title', 'description', 'categoryId', 'condition'] as const;
export type InfoField = (typeof INFO_FIELDS)[number];

export interface StepState {
  /** Cresce a cada envio: a etapa de informações remonta com o que foi digitado. */
  attempt: number;
  values: Partial<Record<InfoField, string>>;
  /** Pelo nome que a API usa em `errors[].field`: "title", "variants.2.priceCents", "images.1". */
  fieldErrors: Record<string, string>;
  formError: string | null;
  /** 412: o produto mudou em outra aba depois que o formulário foi aberto (AC-086). */
  conflict: boolean;
  /** 422 PRODUCT_NOT_PUBLISHABLE: o que falta. */
  missing: PublishGap[];
}

export const EMPTY_STEP_STATE: StepState = {
  attempt: 0,
  values: {},
  fieldErrors: {},
  formError: null,
  conflict: false,
  missing: [],
};

export type StepResult = { ok: true; redirectTo: string } | { ok: false; state: StepState };

const OFFLINE = 'Não conseguimos falar com a Vitrine agora. Tente de novo em instantes.';

/** O problem+json da API como estado da etapa: no campo, no topo, conflito ou o que falta. */
export function problemToStepState(
  status: number,
  problem: Problem | undefined,
  previous: StepState,
  values: StepState['values'] = previous.values,
): StepState {
  const base: StepState = { ...EMPTY_STEP_STATE, attempt: previous.attempt + 1, values };
  if (status === 412) return { ...base, conflict: true };
  if (status === 401) return { ...base, formError: 'Sua sessão expirou. Entre de novo para gravar.' };

  const detail = problem?.detail ?? `Não foi possível gravar (erro ${status}).`;
  switch (problem?.code) {
    case 'VALIDATION_FAILED': {
      const fieldErrors: Record<string, string> = {};
      const loose: string[] = [];
      for (const { field, message } of problem.errors ?? []) {
        if (field) fieldErrors[field] ??= message;
        else loose.push(message);
      }
      return { ...base, fieldErrors, formError: loose.length ? loose.join(' ') : null };
    }
    case 'INVALID_IMAGE':
      return { ...base, fieldErrors: { [`images.${problem.position ?? 0}`]: detail } };
    case 'SIZE_GRID_MISMATCH':
      return { ...base, fieldErrors: { categoryId: detail } };
    case 'PRODUCT_NOT_PUBLISHABLE':
      return { ...base, missing: problem.missing ?? [], formError: detail };
    default:
      return { ...base, formError: detail };
  }
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

/** A versão guardada no campo oculto, no formato do ETag. */
const ifMatch = (formData: FormData) => ({ 'If-Match': `"${text(formData, 'version')}"` });

/** O corpo JSON de uma etapa (grade ou fotos), que a tela manda num campo oculto. */
function payloadOf<T>(formData: FormData): T | null {
  try {
    return JSON.parse(text(formData, 'payload')) as T;
  } catch {
    return null;
  }
}

async function attempt(previous: StepState, values: StepState['values'], call: () => Promise<StepResult>): Promise<StepResult> {
  try {
    return await call();
  } catch {
    return { ok: false, state: { ...EMPTY_STEP_STATE, attempt: previous.attempt + 1, values, formError: OFFLINE } };
  }
}

// ── Gravar cada etapa (AC-083) ────────────────────────────────────────────────

/** Informações: sem `productId`, cria o rascunho; com ele, edita com a versão (If-Match). */
export function saveInfo(api: ApiClient, formData: FormData, previous: StepState = EMPTY_STEP_STATE): Promise<StepResult> {
  const values: StepState['values'] = {};
  for (const field of INFO_FIELDS) values[field] = text(formData, field);
  const body = {
    title: values.title ?? '',
    description: values.description ?? '',
    categoryId: values.categoryId ?? '',
    condition: (values.condition ?? '') as ProductCondition,
  };
  const productId = text(formData, 'productId');

  return attempt(previous, values, async () => {
    const { data, error, response } = productId
      ? await api.PATCH('/v1/seller/products/{id}', { params: { path: { id: productId }, header: ifMatch(formData) }, body })
      : await api.POST('/v1/seller/products', { body });
    if (data) return { ok: true, redirectTo: productUrl(data.id, 'variantes') };
    return { ok: false, state: problemToStepState(response.status, error as Problem | undefined, previous, values) };
  });
}

/** Variantes: a grade inteira; o que não converte nem vai para a API. */
export function saveVariants(api: ApiClient, formData: FormData, previous: StepState = EMPTY_STEP_STATE): Promise<StepResult> {
  const productId = text(formData, 'productId');
  const rows = payloadOf<GridRow[]>(formData) ?? [];
  const { variants, errors } = toVariantInputs(rows);
  if (Object.keys(errors).length > 0) {
    return Promise.resolve({ ok: false, state: { ...EMPTY_STEP_STATE, attempt: previous.attempt + 1, fieldErrors: errors } });
  }

  return attempt(previous, {}, async () => {
    const { data, error, response } = await api.PUT('/v1/seller/products/{id}/variants', {
      params: { path: { id: productId }, header: ifMatch(formData) },
      body: { variants },
    });
    if (data) return { ok: true, redirectTo: productUrl(productId, 'imagens') };
    return { ok: false, state: problemToStepState(response.status, error as Problem | undefined, previous) };
  });
}

export interface ImageChoice {
  path: string;
  alt: string;
  color: string | null;
}

/** Imagens: a ordem (a primeira é a capa), o texto alternativo e a cor de cada uma. */
export function saveImages(api: ApiClient, formData: FormData, previous: StepState = EMPTY_STEP_STATE): Promise<StepResult> {
  const productId = text(formData, 'productId');
  const images = (payloadOf<ImageChoice[]>(formData) ?? []).map(({ path, alt, color }) => ({ path, alt, color }));

  return attempt(previous, {}, async () => {
    const { data, error, response } = await api.PUT('/v1/seller/products/{id}/images', {
      params: { path: { id: productId }, header: ifMatch(formData) },
      body: { images },
    });
    if (data) return { ok: true, redirectTo: productUrl(productId, 'revisao') };
    return { ok: false, state: problemToStepState(response.status, error as Problem | undefined, previous) };
  });
}

/** Revisão: publicar. O que falta volta em `missing` (AC-083). */
export function publishProduct(api: ApiClient, formData: FormData, previous: StepState = EMPTY_STEP_STATE): Promise<StepResult> {
  const productId = text(formData, 'productId');
  return attempt(previous, {}, async () => {
    const { data, error, response } = await api.POST('/v1/seller/products/{id}/publish', {
      params: { path: { id: productId }, header: ifMatch(formData) },
    });
    if (data) return { ok: true, redirectTo: '/minha-loja/produtos' };
    return { ok: false, state: problemToStepState(response.status, error as Problem | undefined, previous) };
  });
}

export type UploadTicketResult = { ok: true; path: string; uploadUrl: string } | { ok: false; message: string };

/** A URL assinada para o navegador enviar uma foto (já reduzida) direto ao Storage. */
export async function requestUpload(api: ApiClient, file: { contentType: string; sizeBytes: number }): Promise<UploadTicketResult> {
  try {
    const { data, error, response } = await api.POST('/v1/seller/uploads', {
      body: { contentType: file.contentType as Schemas['UploadRequestInput']['contentType'], sizeBytes: file.sizeBytes },
    });
    if (data) return { ok: true, path: data.path, uploadUrl: data.uploadUrl };
    const problem = error as Problem | undefined;
    return { ok: false, message: problem?.errors?.[0]?.message ?? problem?.detail ?? `A API respondeu ${response.status}.` };
  } catch {
    return { ok: false, message: OFFLINE };
  }
}

// ── Carregar ──────────────────────────────────────────────────────────────────

export type MyProductsResult =
  | { kind: 'ok'; products: SellerProductSummary[] }
  /** 404 (não vende) ou 403 (loja suspensa): só a loja aprovada cadastra produtos. */
  | { kind: 'not-approved' }
  | { kind: 'error'; message: string };

export async function loadMyProducts(api: ApiClient): Promise<MyProductsResult> {
  try {
    const { data, error, response } = await api.GET('/v1/seller/products');
    if (data) return { kind: 'ok', products: data };
    if (response.status === 403 || response.status === 404) return { kind: 'not-approved' };
    return { kind: 'error', message: (error as Problem | undefined)?.detail ?? `A API respondeu ${response.status}.` };
  } catch {
    return { kind: 'error', message: 'A API não respondeu. Ela está rodando?' };
  }
}

export type ProductEditorResult =
  | { kind: 'ok'; product: SellerProduct; variants: SellerVariant[]; images: ProductImage[] }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

/** O produto, a grade e as fotos, para o formulário abrir na versão atual. */
export async function loadProductEditor(api: ApiClient, id: string): Promise<ProductEditorResult> {
  try {
    const params = { params: { path: { id } } };
    const [product, variants, images] = await Promise.all([
      api.GET('/v1/seller/products/{id}', params),
      api.GET('/v1/seller/products/{id}/variants', params),
      api.GET('/v1/seller/products/{id}/images', params),
    ]);
    if (product.response.status === 404) return { kind: 'not-found' };
    if (!product.data || !variants.data || !images.data) {
      return { kind: 'error', message: `A API respondeu ${product.response.status}.` };
    }
    return { kind: 'ok', product: product.data, variants: variants.data.variants, images: images.data.images };
  } catch {
    return { kind: 'error', message: 'A API não respondeu. Ela está rodando?' };
  }
}

export interface LeafCategory {
  id: string;
  /** O caminho, ex.: "Feminino › Vestidos". */
  label: string;
  sizeType: SizeType;
}

/** Só as categorias sem subcategorias: é onde o produto pode ficar (ASM-023). Se a API falhar, []. */
export async function loadLeafCategories(api: ApiClient): Promise<LeafCategory[]> {
  try {
    const { data } = await api.GET('/v1/categories');
    const leaves: LeafCategory[] = [];
    const walk = (nodes: Schemas['PublicCategoryNode'][], path: string[]) => {
      for (const node of nodes) {
        const here = [...path, node.name];
        if (node.children.length === 0) leaves.push({ id: node.id, label: here.join(' › '), sizeType: node.sizeType });
        else walk(node.children, here);
      }
    };
    walk(data ?? [], []);
    return leaves;
  } catch {
    return [];
  }
}
