import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';

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
    </header>
  );
}
