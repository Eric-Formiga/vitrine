import { MyStore } from '@/components/my-store';
import { loadMyApplication } from '@/lib/api/seller';
import { serverApi } from '@/lib/api/server-fetch';

// "Minha loja" (AC-059). O proxy já garante que só entra quem está logado.
export default async function MinhaLojaPage() {
  const mine = await loadMyApplication(await serverApi());

  if (mine.kind === 'error') {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Minha loja</h1>
        <p role="alert" className="text-muted-foreground">
          Não foi possível carregar a sua loja: {mine.message}
        </p>
      </section>
    );
  }

  return <MyStore application={mine.kind === 'found' ? mine.application : null} now={new Date()} />;
}
