import { redirect } from 'next/navigation';

import { SellerApplicationForm } from '@/components/seller-application-form';
import { publicApi } from '@/lib/api/public-client';
import { canReapply, loadCategoryOptions, loadMyApplication } from '@/lib/api/seller';
import { serverApi } from '@/lib/api/server-fetch';

import { applyForSeller } from './actions';

// Candidatura para vender (AC-058). O proxy já garante que só entra quem está logado.
export default async function VenderPage() {
  const [mine, categories] = await Promise.all([loadMyApplication(await serverApi()), loadCategoryOptions(publicApi)]);

  // Quem já tem loja acompanha por /minha-loja; a rejeitada volta aqui depois do prazo (AC-047).
  if (mine.kind === 'found' && !canReapply(mine.application, new Date())) redirect('/minha-loja');

  return (
    <section className="space-y-6">
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Venda na Vitrine</h1>
        <p className="text-muted-foreground">
          Conte sobre a sua loja e cadastre a chave Pix onde vai receber. A equipe da Vitrine analisa e responde em
          /minha-loja.
        </p>
      </div>
      <SellerApplicationForm action={applyForSeller} categories={categories} />
    </section>
  );
}
