# Spec 01 — Identidade e acesso

**Requisitos:** RF-AUTH-1..5 · RNF-7, RNF-8, RNF-9 · **Módulo Nest:** `identity`

## Objetivo
Autenticar usuários via Clerk e manter na plataforma um registro próprio de usuários, papéis e endereços, que é a fonte de verdade para autorização.

## Histórias e critérios de aceite

### H1 — Cadastro e login
Como visitante, quero criar conta com e-mail, Google ou magic link para comprar.
- **Dado** que não estou logado, **quando** acesso `/checkout`, **então** sou redirecionado ao login do Clerk e volto ao checkout após autenticar.
- **Dado** que criei conta, **quando** o Clerk emite `user.created`, **então** um registro em `users` é criado com `roles = ['customer']` em até 5 s.
- Webhook com assinatura Svix inválida → `400` e nada é gravado.
- Evento duplicado (mesmo `svix-id`) → ignorado (idempotente via upsert por `clerk_id`).

### H2 — Usuário ainda não sincronizado
- **Dado** um JWT válido de usuário que ainda não existe no banco (webhook atrasado), **quando** chamo a API, **então** o guard faz *just-in-time provisioning* buscando o usuário na Clerk Backend API e cria o registro.

### H3 — Autorização por papel e posse
- Rotas `/seller/*` exigem papel `seller` **e** loja `APPROVED` (exceto `/seller/application` e leitura de status).
- Rotas `/admin/*` exigem papel `admin`.
- Acesso a recurso de outro usuário (pedido, endereço, sub-pedido de outra loja) → `404` (não vazar existência).
- Mudança de papel no banco é espelhada em `publicMetadata.roles` no Clerk (via outbox).

### H4 — Endereços
- Ao digitar CEP válido, rua/bairro/cidade/UF são preenchidos (ViaCEP, chamado pelo frontend; backend valida formato).
- Máximo 10 endereços; exatamente um `is_default` quando houver algum.
- Excluir o endereço padrão promove o mais recente.

### H5 — LGPD
- `POST /me/data-export` enfileira geração de JSON (perfil, endereços, pedidos, avaliações) e envia link assinado por e-mail (expira em 24 h).
- `DELETE /me`: bloqueado se houver sub-pedido não finalizado; caso contrário, anonimiza `users` (nome/e-mail/telefone), remove endereços e wishlist, mantém pedidos com dados anonimizados (obrigação fiscal), e exclui o usuário no Clerk.
- Vendedor com loja ativa precisa encerrar a loja antes.

## Implementação
- `ClerkAuthGuard` global usando `verifyToken` do `@clerk/backend` com `jwtKey` (verificação sem rede) e `authorizedParties` = domínio do web.
- Decorators: `@Public()`, `@Roles(...)`, `@CurrentUser()`.
- `CurrentUser` carregado do banco por `clerk_id` com cache em memória de 60 s; invalidado em mudança de papel.
- No Next: `clerkMiddleware` protegendo `(account)`, `seller`, `admin`; checagem de papel na UI via `sessionClaims.metadata.roles` (somente UX).

## Casos de borda
- Usuário excluído no Clerk mas com pedidos → anonimização, nunca hard delete.
- E-mail alterado no Clerk → `user.updated` atualiza `users.email`.
- Admin inicial criado via script de seed (`pnpm seed:admin --email`).
