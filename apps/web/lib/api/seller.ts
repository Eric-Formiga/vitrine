import type { ApiClient, Schemas } from '@vitrine/api-client';

// Regras das telas do vendedor (US-022): montar a candidatura a partir do formulário,
// transformar os erros da API em mensagens por campo e ler a situação da loja.
// Recebem o cliente tipado como parâmetro: o site passa o cliente com o token
// (`serverApi`), os testes passam uma API de mentira.

export type MySellerApplication = Schemas['MySellerApplication'];
export type PixKeyType = Schemas['PixKeyInput']['type'];

/** Campos do formulário, com o mesmo nome que a API usa em `errors[].field`. */
export const APPLICATION_FIELDS = [
  'storeName',
  'slug',
  'bio',
  'document',
  'mainCategoryId',
  'instagram',
  'pixKey.type',
  'pixKey.key',
] as const;
export type ApplicationField = (typeof APPLICATION_FIELDS)[number];

export const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Celular' },
  { value: 'EVP', label: 'Chave aleatória' },
];

export interface ApplicationFormState {
  /** Cresce a cada envio: o formulário remonta com o que a pessoa digitou. */
  attempt: number;
  values: Partial<Record<ApplicationField, string>>;
  fieldErrors: Partial<Record<ApplicationField, string>>;
  /** Erro que não é de um campo (ex.: a conta já tem loja, API fora do ar). */
  formError: string | null;
}

export const EMPTY_APPLICATION_STATE: ApplicationFormState = {
  attempt: 0,
  values: {},
  fieldErrors: {},
  formError: null,
};

export type SubmitResult = { ok: true; redirectTo: string } | { ok: false; state: ApplicationFormState };

type Problem = Partial<Schemas['ProblemDetails']>;

// Erros de domínio que pertencem a um campo do formulário (AC-058). Quando a API não
// manda o `detail`, vale a mensagem daqui.
const FIELD_OF_CODE: Record<string, { field: ApplicationField; fallback: string }> = {
  SLUG_TAKEN: { field: 'slug', fallback: 'Este endereço já é usado por outra loja. Escolha outro.' },
  DOCUMENT_TAKEN: { field: 'document', fallback: 'Este CPF/CNPJ já tem uma loja na Vitrine.' },
  PIX_KEY_OWNER_MISMATCH: {
    field: 'pixKey.key',
    fallback: 'Esta chave Pix não está no CPF/CNPJ da loja. Use uma chave da própria loja.',
  },
  PIX_KEY_NOT_FOUND: { field: 'pixKey.key', fallback: 'Chave Pix não encontrada. Confira o tipo e a chave.' },
  PIX_KEY_CHECK_UNAVAILABLE: {
    field: 'pixKey.key',
    fallback: 'Não conseguimos conferir a chave Pix agora. Tente de novo em alguns minutos.',
  },
};

const isField = (name: string): name is ApplicationField => (APPLICATION_FIELDS as readonly string[]).includes(name);

/** O que a pessoa digitou, como texto, para devolver ao formulário. */
export function readApplicationForm(formData: FormData): Partial<Record<ApplicationField, string>> {
  const values: Partial<Record<ApplicationField, string>> = {};
  for (const field of APPLICATION_FIELDS) {
    const value = formData.get(field);
    if (typeof value === 'string') values[field] = value;
  }
  return values;
}

/** Corpo do POST /v1/seller/application. Campos opcionais vazios não vão. */
export function toApplicationBody(values: Partial<Record<ApplicationField, string>>): Schemas['SellerApplicationInput'] {
  const slug = values.slug?.trim();
  const instagram = values.instagram?.trim();
  return {
    storeName: values.storeName ?? '',
    bio: values.bio ?? '',
    document: values.document ?? '',
    mainCategoryId: values.mainCategoryId ?? '',
    ...(slug ? { slug } : {}),
    ...(instagram ? { instagram } : {}),
    // Um tipo fora da lista volta da API como erro do campo `pixKey.type`.
    pixKey: { type: (values['pixKey.type'] ?? '') as PixKeyType, key: values['pixKey.key'] ?? '' },
  };
}

/** Transforma o problem+json da API em mensagens junto ao campo, ou do formulário. */
export function problemToFormErrors(
  status: number,
  problem: Problem | undefined,
): Pick<ApplicationFormState, 'fieldErrors' | 'formError'> {
  const fieldErrors: ApplicationFormState['fieldErrors'] = {};
  const loose: string[] = [];

  if (problem?.code === 'VALIDATION_FAILED' && problem.errors?.length) {
    for (const { field, message } of problem.errors) {
      if (isField(field)) fieldErrors[field] ??= message;
      else loose.push(message);
    }
    return { fieldErrors, formError: loose.length ? loose.join(' ') : null };
  }

  const byCode = problem?.code ? FIELD_OF_CODE[problem.code] : undefined;
  if (byCode) {
    fieldErrors[byCode.field] = problem?.detail || byCode.fallback;
    return { fieldErrors, formError: null };
  }

  if (status === 401) return { fieldErrors, formError: 'Sua sessão expirou. Entre de novo para enviar.' };
  // SELLER_APPLICATION_EXISTS e o resto: o `detail` já diz o que fazer (e a data, se rejeitada).
  return { fieldErrors, formError: problem?.detail || `Não foi possível enviar a candidatura (erro ${status}).` };
}

/** Envia a candidatura. Sucesso leva para /minha-loja; erro devolve o formulário preenchido. */
export async function submitSellerApplication(
  api: ApiClient,
  formData: FormData,
  previous: ApplicationFormState = EMPTY_APPLICATION_STATE,
): Promise<SubmitResult> {
  const values = readApplicationForm(formData);
  const failed = (errors: Pick<ApplicationFormState, 'fieldErrors' | 'formError'>): SubmitResult => ({
    ok: false,
    state: { attempt: previous.attempt + 1, values, ...errors },
  });

  try {
    const { error, response } = await api.POST('/v1/seller/application', { body: toApplicationBody(values) });
    if (response.ok) return { ok: true, redirectTo: '/minha-loja' };
    return failed(problemToFormErrors(response.status, error as Problem | undefined));
  } catch {
    return failed({
      fieldErrors: {},
      formError: 'Não conseguimos falar com a Vitrine agora. Tente de novo em instantes.',
    });
  }
}

export type MyApplicationResult =
  | { kind: 'found'; application: MySellerApplication }
  | { kind: 'none' }
  | { kind: 'error'; message: string };

/** Situação da loja da pessoa logada. 404 = ainda não se candidatou (AC-059). */
export async function loadMyApplication(api: ApiClient): Promise<MyApplicationResult> {
  try {
    const { data, error, response } = await api.GET('/v1/seller/application');
    if (data) return { kind: 'found', application: data };
    if (response.status === 404) return { kind: 'none' };
    return { kind: 'error', message: (error as Problem | undefined)?.detail ?? `A API respondeu ${response.status}.` };
  } catch {
    return { kind: 'error', message: 'A API não respondeu. Ela está rodando?' };
  }
}

/** A rejeitada pode se candidatar de novo a partir de `canReapplyAt` (AC-047). */
export function canReapply(application: MySellerApplication, now: Date): boolean {
  return application.rejection !== null && new Date(application.rejection.canReapplyAt) <= now;
}

/** Link do cabeçalho: "Minha loja" para quem já tem candidatura, "Vender" para o resto. */
export async function sellerNavLink(api: ApiClient): Promise<{ href: string; label: string }> {
  const result = await loadMyApplication(api);
  return result.kind === 'found' ? { href: '/minha-loja', label: 'Minha loja' } : { href: '/vender', label: 'Vender' };
}

export interface CategoryOption {
  id: string;
  label: string;
}

/**
 * Categorias para a categoria principal: a árvore inteira, em ordem, com os níveis
 * marcados no nome (qualquer categoria ativa vale, ASM-021). Se a API falhar, [].
 */
export async function loadCategoryOptions(api: ApiClient): Promise<CategoryOption[]> {
  try {
    const { data } = await api.GET('/v1/categories');
    const options: CategoryOption[] = [];
    const walk = (nodes: Schemas['PublicCategoryNode'][], depth: number) => {
      for (const node of nodes) {
        options.push({ id: node.id, label: `${'— '.repeat(depth)}${node.name}` });
        walk(node.children, depth + 1);
      }
    };
    walk(data ?? [], 0);
    return options;
  } catch {
    return [];
  }
}
