'use server';

import { redirect } from 'next/navigation';

import { type ApplicationFormState, submitSellerApplication } from '@/lib/api/seller';
import { serverApi } from '@/lib/api/server-fetch';

// Server Action do formulário de candidatura (AC-058): envia para a API com o token
// da sessão; com sucesso vai para /minha-loja, com erro devolve o formulário preenchido.
export async function applyForSeller(previous: ApplicationFormState, formData: FormData): Promise<ApplicationFormState> {
  const result = await submitSellerApplication(await serverApi(), formData, previous);
  if (result.ok) redirect(result.redirectTo);
  return result.state;
}
