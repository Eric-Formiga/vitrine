'use client';

import { type ComponentProps, type ReactNode, useActionState } from 'react';

import { Button } from '@/components/ui/button';
import {
  type ApplicationField,
  type ApplicationFormState,
  type CategoryOption,
  EMPTY_APPLICATION_STATE,
  PIX_KEY_TYPES,
} from '@/lib/api/seller';
import { cn } from '@/lib/utils';

export type ApplyAction = (previous: ApplicationFormState, formData: FormData) => Promise<ApplicationFormState>;

const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm aria-[invalid=true]:border-red-600 focus-visible:outline-2 focus-visible:outline-primary';

const idOf = (field: ApplicationField) => `field-${field.replace('.', '-')}`;

// Formulário de candidatura (AC-058). O envio é uma Server Action: os erros da API
// voltam como mensagens junto a cada campo, e o que a pessoa digitou continua lá.
export function SellerApplicationForm({
  action,
  categories,
  initialState = EMPTY_APPLICATION_STATE,
}: {
  action: ApplyAction;
  categories: CategoryOption[];
  initialState?: ApplicationFormState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const { values, fieldErrors } = state;

  // Liga o campo à sua mensagem de erro (aria-describedby) e devolve o valor digitado.
  const control = (field: ApplicationField) => ({
    id: idOf(field),
    name: field,
    defaultValue: values[field] ?? '',
    'aria-invalid': fieldErrors[field] ? true : undefined,
    'aria-describedby': fieldErrors[field] ? `${idOf(field)}-error` : undefined,
  });

  const field = (name: ApplicationField, label: string, input: ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={idOf(name)} className="block text-sm font-medium">
        {label}
      </label>
      {input}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {fieldErrors[name] ? (
        <p id={`${idOf(name)}-error`} className="text-sm text-red-700 dark:text-red-400">
          {fieldErrors[name]}
        </p>
      ) : null}
    </div>
  );

  const text = (name: ApplicationField, props: ComponentProps<'input'> = {}) => (
    <input type="text" className={inputClass} {...props} {...control(name)} />
  );

  // A `key` remonta o formulário a cada resposta: os campos voltam com o que foi enviado.
  return (
    <form key={state.attempt} action={formAction} noValidate className="max-w-xl space-y-5">
      {state.formError ? (
        <p role="alert" className="rounded-md border border-red-600/40 p-3 text-sm text-red-700 dark:text-red-400">
          {state.formError}
        </p>
      ) : null}

      {field('storeName', 'Nome da loja', text('storeName', { required: true, maxLength: 60 }))}
      {field(
        'slug',
        'Endereço da loja (opcional)',
        text('slug', { placeholder: 'ex.: atelie-da-ana', maxLength: 60 }),
        'Fica em /loja/{endereço}. Em branco, usamos o nome da loja.',
      )}
      {field(
        'bio',
        'Sobre a loja',
        <textarea rows={4} required maxLength={500} className={inputClass} {...control('bio')} />,
      )}
      {field(
        'document',
        'CPF ou CNPJ da loja',
        text('document', { required: true, inputMode: 'numeric' }),
        'Com ou sem pontuação. Aparece mascarado para você e para os clientes.',
      )}
      {field(
        'mainCategoryId',
        'Categoria principal',
        <select required className={inputClass} {...control('mainCategoryId')}>
          <option value="">Escolha uma categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>,
        categories.length === 0 ? 'Não conseguimos carregar as categorias. Recarregue a página.' : undefined,
      )}
      {field('instagram', 'Instagram (opcional)', text('instagram', { placeholder: '@sualoja' }))}

      <fieldset className="space-y-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Chave Pix de recebimento</legend>
        <p className="text-xs text-muted-foreground">
          Conferimos no Asaas se a chave está no CPF/CNPJ da loja. É nela que você recebe as vendas.
        </p>
        {field(
          'pixKey.type',
          'Tipo da chave',
          <select required className={inputClass} {...control('pixKey.type')}>
            <option value="">Escolha o tipo</option>
            {PIX_KEY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>,
        )}
        {field('pixKey.key', 'Chave', text('pixKey.key', { required: true, maxLength: 77 }))}
      </fieldset>

      <Button type="submit" disabled={pending} className={cn(pending && 'cursor-wait')}>
        {pending ? 'Conferindo a chave Pix…' : 'Enviar candidatura'}
      </Button>
    </form>
  );
}
