import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Suspense } from 'react';

import { CategoryMenu } from '@/components/category-menu';
import { Button } from '@/components/ui/button';
import { loadDepartments } from '@/lib/api/categories';
import { sellerNavLink } from '@/lib/api/seller';
import { serverApi } from '@/lib/api/server-fetch';

// Busca os departamentos no servidor. Fica em Suspense: a página não espera o menu.
async function DepartmentsMenu() {
  return <CategoryMenu departments={await loadDepartments()} />;
}

// "Vender", ou "Minha loja" para quem já tem candidatura (GET /v1/seller/application).
// Se a API não responder, mostra "Vender": a página /vender leva a /minha-loja quem já tem loja.
async function SellerLink() {
  const { href, label } = await sellerNavLink(await serverApi());
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Vitrine
        </Link>
        <nav className="flex items-center gap-2">
          {/* Show lê a sessão da requisição: fica dentro de Suspense. */}
          <Suspense>
            <Show when="signed-out">
              <SignInButton>
                <Button variant="ghost" size="sm">
                  Entrar
                </Button>
              </SignInButton>
              <SignUpButton>
                <Button size="sm">Criar conta</Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <SellerLink />
              <Button asChild variant="ghost" size="sm">
                <Link href="/conta">Minha conta</Link>
              </Button>
              <UserButton />
            </Show>
          </Suspense>
        </nav>
      </div>
      <Suspense fallback={null}>
        <DepartmentsMenu />
      </Suspense>
    </header>
  );
}
