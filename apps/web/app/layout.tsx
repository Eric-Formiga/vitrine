import { ClerkProvider } from '@clerk/nextjs';
import { ptBR } from '@clerk/localizations';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/site-header';

import './globals.css';

export const metadata: Metadata = {
  title: 'Vitrine',
  description: 'Marketplace multi-vendedor de moda',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        {/* Nas versões atuais do Clerk, o provider fica dentro do <body>. */}
        <ClerkProvider localization={ptBR} signInUrl="/sign-in" signUpUrl="/sign-up">
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
