import { ApiError, apiFetch } from '@/lib/api/server-fetch';

interface Me {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = { customer: 'Comprador', seller: 'Vendedor', admin: 'Admin' };

// Área do comprador. O proxy já garante que só entra quem está logado (AC-009).
export default async function ContaPage() {
  let me: Me;
  try {
    me = await apiFetch<Me>('/v1/me');
  } catch (error) {
    const detail = error instanceof ApiError ? error.message : 'A API não respondeu. Ela está rodando?';
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Minha conta</h1>
        <p role="alert" className="text-muted-foreground">
          Não foi possível carregar seu perfil: {detail}
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Olá, {me.name ?? me.email}</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-3 rounded-md border border-border p-5 text-sm">
        <dt className="text-muted-foreground">E-mail</dt>
        <dd>{me.email}</dd>
        <dt className="text-muted-foreground">Papéis</dt>
        <dd>{me.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ')}</dd>
        <dt className="text-muted-foreground">ID na Vitrine</dt>
        <dd className="font-mono text-xs">{me.id}</dd>
      </dl>
      <p className="text-sm text-muted-foreground">Pedidos, endereços e favoritos aparecem aqui nas próximas fases.</p>
    </section>
  );
}
