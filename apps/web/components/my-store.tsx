import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { canReapply, type MySellerApplication, PIX_KEY_TYPES } from '@/lib/api/seller';

const STATUS: Record<MySellerApplication['status'], { label: string; text: string }> = {
  PENDING: {
    label: 'Em análise',
    text: 'Recebemos sua candidatura. A equipe da Vitrine confere os dados e a chave Pix e responde por aqui.',
  },
  APPROVED: { label: 'Aprovada', text: 'Sua loja está aprovada.' },
  REJECTED: { label: 'Rejeitada', text: 'Sua candidatura não foi aprovada.' },
  SUSPENDED: { label: 'Suspensa', text: 'Sua loja está suspensa e não aparece para os clientes.' },
};

const CHECKLIST: { key: keyof MySellerApplication['checklist']; label: string }[] = [
  { key: 'store', label: 'Dados da loja' },
  { key: 'pixKey', label: 'Chave Pix' },
  { key: 'shipping', label: 'Frete' },
];

// Datas no fuso da Vitrine, como a API escreve nas mensagens.
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// Página "minha loja" (AC-059): situação, titular da chave Pix conferida e checklist.
// Sem candidatura (a API respondeu 404), mostra o convite para /vender.
export function MyStore({ application, now }: { application: MySellerApplication | null; now: Date }) {
  if (!application) {
    return (
      <section className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Minha loja</h1>
        <p className="text-muted-foreground">
          Você ainda não tem uma loja na Vitrine. Conte sobre ela, cadastre a chave Pix onde vai receber e a gente
          analisa.
        </p>
        <Button asChild>
          <Link href="/vender">Quero vender na Vitrine</Link>
        </Button>
      </section>
    );
  }

  const status = STATUS[application.status];
  const { pixKey, rejection, suspension } = application;
  const pixType = PIX_KEY_TYPES.find((type) => type.value === pixKey.type)?.label ?? pixKey.type;

  return (
    <section className="max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{application.storeName}</h1>
        <p>
          <span className="text-sm text-muted-foreground">Situação: </span>
          <strong data-status={application.status}>{status.label}</strong>
        </p>
        <p className="text-sm text-muted-foreground">{status.text}</p>
      </header>

      {rejection ? (
        <div role="status" className="space-y-1 rounded-md border border-border p-4 text-sm">
          <p>
            <span className="font-medium">Motivo: </span>
            {rejection.reason}
          </p>
          {canReapply(application, now) ? (
            <p>
              Você já pode se candidatar de novo.{' '}
              <Link href="/vender" className="font-medium text-primary underline">
                Enviar nova candidatura
              </Link>
            </p>
          ) : (
            <p>Você pode se candidatar de novo a partir de {day(rejection.canReapplyAt)}.</p>
          )}
        </div>
      ) : null}

      {suspension ? (
        <div role="status" className="space-y-1 rounded-md border border-border p-4 text-sm">
          <p>
            <span className="font-medium">Motivo: </span>
            {suspension.reason}
          </p>
          <p>Suspensa em {day(suspension.suspendedAt)}.</p>
        </div>
      ) : null}

      <dl className="grid grid-cols-[9rem_1fr] gap-y-3 rounded-md border border-border p-5 text-sm">
        <dt className="text-muted-foreground">Endereço</dt>
        <dd>/loja/{application.slug}</dd>
        <dt className="text-muted-foreground">CPF/CNPJ</dt>
        <dd>{application.document}</dd>
        <dt className="text-muted-foreground">Chave Pix</dt>
        <dd>
          {pixType}: {pixKey.key}
        </dd>
        <dt className="text-muted-foreground">Titular da chave</dt>
        <dd>
          {pixKey.ownerName} ({pixKey.ownerDocument})
          <span className="block text-xs text-muted-foreground">Conferido no Asaas em {day(pixKey.verifiedAt)}</span>
        </dd>
      </dl>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Para começar a vender</h2>
        <ul aria-label="Checklist da loja" className="space-y-1 text-sm">
          {CHECKLIST.map(({ key, label }) => {
            const done = application.checklist[key];
            return (
              <li key={key} data-done={done}>
                <span aria-hidden="true">{done ? '✓' : '○'}</span> {label}: {done ? 'pronto' : 'pendente'}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
