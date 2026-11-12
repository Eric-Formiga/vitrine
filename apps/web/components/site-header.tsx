import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Suspense } from 'react';

import { CategoryMenu } from '@/components/category-menu';
import { Button } from '@/components/ui/button';
import { loadDepartments } from '@/lib/api/categories';

// Busca os departamentos no servidor. Fica em Suspense: a página não espera o menu.
async function DepartmentsMenu() {
  return <CategoryMenu departments={await loadDepartments()} />;
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
