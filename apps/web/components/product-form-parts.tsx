import { productUrl, type Step, type StepState } from '@/lib/api/products';

// Peças comuns às etapas do formulário de produto (AC-083, AC-086).

export type StepAction = (previous: StepState, formData: FormData) => Promise<StepState>;

export const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm aria-[invalid=true]:border-red-600 focus-visible:outline-2 focus-visible:outline-primary';

/** Id do controle a partir do nome do campo da API ("variants.2.priceCents" → "field-variants-2-priceCents"). */
export const fieldId = (field: string) => `field-${field.replace(/\./g, '-')}`;

/** Atributos que ligam o controle à mensagem de erro dele (aria-describedby). */
export function errorProps(state: StepState, field: string) {
  const message = state.fieldErrors[field];
  return {
    id: fieldId(field),
    'aria-invalid': message ? true : undefined,
    'aria-describedby': message ? `${fieldId(field)}-error` : undefined,
  } as const;
}

export function FieldError({ state, field }: { state: StepState; field: string }) {
  const message = state.fieldErrors[field];
  return message ? (
    <p id={`${fieldId(field)}-error`} className="text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  ) : null;
}

/** A versão que a tela está editando vai junto em toda gravação (If-Match). */
export function HiddenRef({ productId, version }: { productId: string; version: number }) {
  return (
    <>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="version" value={version} />
    </>
  );
}

/**
 * Topo da etapa: o conflito de versão (412) com "Recarregar", ou o erro que não é de um
 * campo. No conflito, nada do que foi digitado some até a pessoa recarregar (AC-086).
 */
export function StepAlerts({ state, productId, step }: { state: StepState; productId: string | null; step: Step }) {
  if (state.conflict) {
    return (
      <div role="alert" data-conflict="true" className="space-y-2 rounded-md border border-amber-600/50 p-4 text-sm">
        <p>
          Este produto mudou em outra aba depois que você abriu o formulário. O que você digitou continua aqui; recarregue
          para ver a versão atual antes de gravar.
        </p>
        {productId ? (
          // Um <a> comum: a página recarrega inteira, e a etapa abre com a versão nova.
          <a href={productUrl(productId, step)} className="font-medium text-primary underline">
            Recarregar
          </a>
        ) : null}
      </div>
    );
  }
  return state.formError ? (
    <p role="alert" className="rounded-md border border-red-600/40 p-3 text-sm text-red-700 dark:text-red-400">
      {state.formError}
    </p>
  ) : null;
}
