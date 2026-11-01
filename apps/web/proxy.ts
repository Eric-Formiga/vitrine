import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

// Áreas que exigem login. O resto do site (loja, busca, lojas) é público (AC-010).
// Casa /conta e /conta/..., mas não /contato: '/conta(.*)' pegaria qualquer prefixo.
const isPrivateRoute = createRouteMatcher([/^\/(conta|seller|admin)(\/|$)/]);

type SessionReader = () => Promise<{ userId: string | null }>;

// Visitante sem sessão numa área privada vai para o login, levando o endereço de volta (AC-009).
export async function guardPrivateRoutes(auth: SessionReader, req: NextRequest): Promise<NextResponse | undefined> {
  if (!isPrivateRoute(req)) return undefined;

  const { userId } = await auth();
  if (userId) return undefined;

  const signIn = new URL('/sign-in', req.url);
  signIn.searchParams.set('redirect_url', req.url);
  return NextResponse.redirect(signIn);
}

// Proxy do Next 16 (antigo middleware): o Clerk lê a sessão e entrega à regra acima.
export default clerkMiddleware((auth, req) => guardPrivateRoutes(auth, req));

export const config = {
  matcher: [
    // Tudo, menos arquivos internos do Next e estáticos (a não ser que venham na query).
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
