# Spec: Fundação — esqueleto da Vitrine com login

> feature: fundacao
> status: em-implementacao

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - US-xxx = história de usuário · AC-xxx = critério de aceite
    ASM-xxx = suposição · Q-xxx = pergunta em aberto
    São códigos de rastreio: ligam a especificação às tarefas e aos testes.
  - Toda história de usuário precisa de pelo menos um critério de aceite.
  - Todo critério de aceite precisa de Dado/Quando/Então completos.
  - Os códigos são únicos no projeto inteiro (nunca reutilize um número).
  - Suposições e Perguntas em aberto são OBRIGATÓRIAS: se não há nenhuma,
    escreva "Nenhuma." — mas desconfie: quase toda feature esconde uma.
-->

## Contexto

Primeira fatia do [roadmap](../../../docs/ROADMAP.md): a Fase 0, só a parte de
código (ver Q-001). Ao final, o monorepo tem a API e o site de pé, e o login com
Clerk funciona de ponta a ponta: uma pessoa cria a conta, entra no site e passa
a existir na tabela `users` da Vitrine — a fonte de verdade para autorização.

Base: [PRD](../../../docs/PRD.md) (RF-AUTH-1..3, RNF-7, RNF-8, RNF-11, RNF-12),
[spec 01](../../../docs/specs/01-identidade-e-acesso.md) (H1–H3),
[ARCHITECTURE](../../../docs/ARCHITECTURE.md) (§3–§5, §7, §9, §13) e as ADRs
0002, 0003, 0009 e 0010.

## Histórias

### US-001 — Quem cria conta passa a existir na Vitrine

Como visitante, quero criar minha conta (e-mail e senha, Google ou link mágico)
e já fazer parte da Vitrine, para comprar agora e, no futuro, vender.

#### AC-001 — Conta nova no Clerk vira usuário da Vitrine

- **Dado** que uma pessoa acabou de criar a conta no Clerk
- **Quando** o Clerk avisa a Vitrine (evento `user.created` com assinatura Svix válida em `POST /v1/webhooks/clerk`)
- **Então** a pessoa passa a existir na tabela de usuários como compradora (`roles = ['customer']`), com o nome e o e-mail do Clerk
- **E** o aviso é aceito (200)

#### AC-002 — Aviso falso é recusado sem gravar nada

- **Dado** um aviso com assinatura inválida ou sem assinatura
- **Quando** ele chega ao endereço de avisos do Clerk
- **Então** ele é recusado (400)
- **E** nenhum usuário é criado ou alterado

#### AC-003 — Aviso repetido não duplica a pessoa

- **Dado** que a pessoa já existe na Vitrine (o aviso já foi processado antes, ou ela foi cadastrada no primeiro acesso — AC-006)
- **Quando** o Clerk envia de novo o aviso de criação dela
- **Então** continua existindo uma única pessoa para aquela conta (gravação idempotente por `clerk_id`)
- **E** o aviso é aceito (200)

#### AC-004 — Nome ou e-mail alterado no Clerk é atualizado na Vitrine

- **Dado** uma pessoa já cadastrada
- **Quando** ela muda o nome ou o e-mail no Clerk (evento `user.updated`)
- **Então** o perfil dela na Vitrine passa a ter o nome e o e-mail novos

#### AC-005 — Conta excluída é anonimizada, nunca apagada

- **Dado** uma pessoa já cadastrada
- **Quando** ela exclui a conta no Clerk (evento `user.deleted`)
- **Então** nome, e-mail e telefone dela são trocados por valores anônimos e ela fica marcada como excluída (`deleted_at`)
- **E** o registro continua no banco, para preservar o histórico de pedidos que vier a existir

### US-002 — Quem acabou de se cadastrar já consegue usar a Vitrine

Como pessoa recém-cadastrada, quero usar a Vitrine na hora, mesmo que o aviso do
Clerk ainda não tenha chegado, para não ficar travada logo no primeiro acesso.

#### AC-006 — Cadastro na hora do primeiro acesso

- **Dado** uma pessoa logada (token válido do Clerk) que ainda não existe na tabela de usuários
- **Quando** ela abre o próprio perfil (`GET /v1/me`)
- **Então** a Vitrine busca os dados dela no Clerk e a cadastra como compradora
- **E** o perfil aparece normalmente (200)

### US-003 — Só quem está logado acessa as rotas privadas da API

Como pessoa usuária, quero que meus dados só sejam acessíveis por mim, para
confiar na plataforma.

#### AC-007 — Sem login, sem acesso

- **Dado** uma requisição sem token, com token inválido ou com token expirado
- **Quando** ela chama uma rota privada (ex.: `GET /v1/me`)
- **Então** a resposta avisa que é preciso entrar (401, no formato padrão de erro)

#### AC-008 — O perfil mostra os papéis guardados na Vitrine

- **Dado** uma pessoa logada cujos papéis na Vitrine são diferentes dos que aparecem no token
- **Quando** ela abre o próprio perfil (`GET /v1/me`)
- **Então** vê id, nome, e-mail e os papéis guardados na Vitrine (o banco é a fonte de verdade, nunca o token)

### US-004 — O site protege as áreas privadas

Como visitante, quero navegar livremente pela loja e só precisar entrar quando
abro uma área privada, para comprar sem atrito.

#### AC-009 — Área privada leva ao login

- **Dado** um visitante sem sessão
- **Quando** ele abre uma área privada do site (`/conta`, `/seller` ou `/admin`)
- **Então** é levado para a página de login
- **E** o link de login guarda o endereço da página que ele tentou abrir, para voltar a ela depois de entrar

#### AC-010 — Páginas públicas abrem sem login

- **Dado** um visitante sem sessão
- **Quando** ele abre uma página pública (`/`, `/busca`, `/c/...` ou `/loja/...`)
- **Então** o site não pede login

### US-005 — Dá para saber se a API está de pé

Como operador da plataforma, quero consultar a saúde da API, para monitorar a
demo e manter o banco gratuito acordado.

#### AC-011 — "Viva" responde mesmo com o banco fora do ar

- **Dado** a API rodando, mesmo que o banco esteja fora do ar
- **Quando** alguém consulta `GET /health/live`
- **Então** a resposta é 200

#### AC-012 — "Pronta" só quando banco e filas funcionam

- **Dado** a API rodando
- **Quando** alguém consulta `GET /health/ready`
- **Então** a resposta é 200 se o Postgres responde e as filas (pg-boss) estão iniciadas
- **E** a resposta é 503 se o Postgres estiver fora do ar

### US-006 — Erros previsíveis e cada requisição rastreável

Como quem consome a API (o site e quem investiga problemas), quero erros num
formato único e cada requisição identificada, para tratar falhas e achar a
causa rápido.

#### AC-013 — Erros vêm sempre no mesmo formato, sem expor detalhes internos

- **Dado** uma rota que não existe, ou uma falha inesperada dentro da API
- **Quando** a API responde com erro
- **Então** a resposta vem como `application/problem+json` com `type`, `title`, `status` e `detail` (RFC 9457)
- **E** a falha inesperada vira 500 sem mostrar a pilha de erro (stack trace) para quem chamou

#### AC-014 — Cada requisição tem um identificador

- **Dado** uma requisição qualquer à API
- **Quando** a resposta volta
- **Então** ela traz o cabeçalho `x-request-id`
- **E** o log daquela requisição (JSON, pino) tem o mesmo `requestId`

### US-007 — A API não sobe com configuração errada

Como dev, quero que a API se recuse a iniciar com configuração inválida, para
achar o erro na hora, e não em produção.

#### AC-015 — Variável obrigatória ausente impede a subida

- **Dado** que falta uma variável de ambiente obrigatória (ex.: `DATABASE_URL`)
- **Quando** a API tenta iniciar
- **Então** ela não sobe e a mensagem diz o nome da variável que falta
- **E** nenhum valor de segredo aparece na mensagem

### US-008 — Filas rodam junto com a API e desligam com segurança

Como operador, quero a API e as filas no mesmo processo na demo e um
desligamento que não interrompa trabalho no meio, para caber no orçamento sem
perder jobs (ADR-0010).

#### AC-016 — Com `RUN_WORKER=true`, a própria API executa os jobs

- **Dado** a API iniciada com `RUN_WORKER=true`
- **Quando** um job é enfileirado
- **Então** o mesmo processo o executa

#### AC-017 — Com `RUN_WORKER=false`, a API só enfileira

- **Dado** a API iniciada com `RUN_WORKER=false`
- **Quando** um job é enfileirado
- **Então** ele fica na fila sem ser executado (nenhum consumidor foi iniciado)

#### AC-018 — Desligamento espera o job em andamento

- **Dado** um job em execução
- **Quando** o processo recebe o sinal de desligamento (`SIGTERM`)
- **Então** a API para de aceitar requisições novas e espera o job terminar (até 30 s) antes de encerrar

## Fora de escopo

- CI no GitHub Actions, deploy (Vercel, Railway, Supabase) e o health check agendado → feature `ci-e-deploy` (Q-001).
- Spike do Stripe Connect → feature `spike-stripe-connect` (Q-001).
- Papéis além de `customer`, `@Roles`, checagem de posse e espelhamento dos papéis no Clerk (spec 01 H3) → Fase 1, junto com vendedores e admin.
- Endereços com ViaCEP (spec 01 H4) → Fase 2.
- Exportar dados e excluir a conta pela Vitrine (LGPD, spec 01 H5) → Fase 4 (bônus).
- Outbox e relay de eventos → Fase 2.
- Páginas da loja (home real, busca, categoria, produto) → Fase 1. Aqui o site tem só layout base, tema e login.
- Seed do admin inicial (`pnpm seed:admin`) → Fase 1.
- Contrato OpenAPI e cliente tipado (ADR-0008) → entram com os primeiros endpoints de negócio, na Fase 1.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | Todos os testes — vários arquivos, espalhados pela API, pelo site e pelos pacotes — rodam com um único comando Vitest na raiz do monorepo, que gera um relatório JSON lido pelo onp-spec | confirmada | confirmado pelo dono do produto em 01/11/2026 |
| ASM-002 | Testes de integração usam Postgres real em Docker (Testcontainers); o Docker precisa estar rodando na máquina e no CI | confirmada | confirmado pelo dono do produto em 01/11/2026 |
| ASM-003 | Health checks ficam fora da versão (`/health/live`, `/health/ready`); o resto da API fica sob `/v1`, inclusive `/v1/webhooks/clerk` | confirmada | confirmado pelo dono do produto em 01/11/2026 |
| ASM-004 | Todo usuário do Clerk tem e-mail primário: o cadastro é só por e-mail e senha, Google ou link mágico (sem cadastro só por telefone) | confirmada | confirmado pelo dono do produto em 01/11/2026 |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | A Fase 0 inclui CI, deploy e o spike do Stripe, que dependem de contas do dono do projeto. Entram nesta feature? | respondida | Não. Esta feature cobre só o código; CI + deploy e o spike do Stripe viram features separadas (decidido em 01/11/2026) |
