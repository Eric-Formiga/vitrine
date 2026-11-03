# Spec: Categorias — árvore do catálogo, admin e contrato da API

> feature: categorias
> status: rascunho

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

Primeira das cinco features da Fase 1 do [roadmap](../../../docs/ROADMAP.md)
(categorias → vendedores → produtos → vitrine → busca; decidido em 03/11/2026).
Ao final, a Vitrine tem a árvore de categorias de moda que classifica os
produtos, um admin que a mantém pela API e um registro de auditoria de toda
ação do admin. Esta feature também traz o que a fundação deixou para a Fase 1:
o papel `admin` com proteção das rotas `/admin/*`, o seed do admin inicial e o
contrato OpenAPI com o cliente tipado (ADR-0008), que estreia aqui com o
primeiro endpoint de negócio.

Base: [PRD](../../../docs/PRD.md) (RF-CAT-4, RF-ADM-5),
[spec 01](../../../docs/specs/01-identidade-e-acesso.md) (H3, seed do admin),
[spec 03](../../../docs/specs/03-catalogo-e-busca.md) (modelo de produto: tamanhos por tipo de categoria),
[spec 10](../../../docs/specs/10-painel-admin.md) (categorias, auditoria, regras),
[API](../../../docs/API.md) (`/categories`, `/admin/categories`, erros),
[DATA_MODEL](../../../docs/DATA_MODEL.md) (`categories`, `audit_logs`) e a ADR-0008.

## Histórias

### US-009 — Existe um admin desde o primeiro dia

Como dono da plataforma, quero transformar uma conta já cadastrada em admin com
um comando, para operar a Vitrine sem mexer no banco à mão.

#### AC-019 — O comando de seed torna a pessoa admin

- **Dado** uma pessoa já cadastrada na Vitrine com o e-mail `ana@exemplo.com`
- **Quando** alguém roda o seed do admin com esse e-mail (`pnpm seed:admin --email ana@exemplo.com`)
- **Então** ela passa a ter o papel `admin`, sem perder os papéis que já tinha
- **E** rodar o comando de novo não repete o papel

#### AC-020 — E-mail desconhecido não muda nada

- **Dado** que nenhuma pessoa da Vitrine tem o e-mail informado (ou a conta dela foi excluída)
- **Quando** alguém roda o seed do admin com esse e-mail
- **Então** o comando termina com erro e diz que não achou a conta
- **E** nenhum usuário é alterado

### US-010 — A área de admin da API é só do admin

Como dono da plataforma, quero que só admins acessem as rotas de administração,
e que quem não é admin nem descubra que elas existem.

#### AC-021 — Quem não é admin não vê a área de admin

- **Dado** uma pessoa logada sem o papel `admin`
- **Quando** ela chama qualquer rota de administração (`/v1/admin/...`)
- **Então** a resposta é a mesma de uma rota que não existe (404, no formato padrão de erro)
- **E** sem login, a resposta continua sendo "é preciso entrar" (401)

#### AC-022 — Admin entra na área de admin

- **Dado** uma pessoa logada com o papel `admin` guardado no banco
- **Quando** ela chama uma rota de administração (ex.: `GET /v1/admin/categories`)
- **Então** a rota responde normalmente (200)

### US-011 — Visitante navega pela árvore de categorias

Como visitante, quero ver as categorias da loja organizadas em árvore, para
achar o tipo de peça que procuro.

#### AC-023 — A árvore de categorias é pública e ordenada

- **Dado** categorias cadastradas em mais de um nível (ex.: Feminino › Vestidos)
- **Quando** qualquer pessoa, logada ou não, pede a árvore (`GET /v1/categories`)
- **Então** recebe as categorias aninhadas (pai com as filhas), cada uma com id, nome, slug, tipo de tamanho e guia de medidas
- **E** em cada nível elas vêm na ordem definida pelo admin (posição) e, empatadas, por nome
- **E** categorias arquivadas não aparecem

#### AC-024 — O seed cria a árvore inicial de moda sem duplicar

- **Dado** um banco sem categorias
- **Quando** o seed das categorias roda
- **Então** a árvore inicial de moda existe (departamentos Feminino, Masculino, Calçados e Acessórios, com subcategorias)
- **E** rodar o seed de novo não duplica nada (cada categoria é identificada pelo slug)

#### AC-025 — O menu do site mostra os departamentos

- **Dado** a árvore de categorias cadastrada
- **Quando** alguém abre qualquer página do site
- **Então** o cabeçalho mostra as categorias de primeiro nível, na ordem da árvore, cada uma com link para `/c/{slug}`
- **E** se a API não responder, o site abre normalmente, só sem o menu

### US-012 — Admin mantém as categorias

Como admin, quero criar, editar, mover e remover categorias, para organizar o
catálogo conforme ele cresce.

#### AC-026 — Criar categoria

- **Dado** um admin logado
- **Quando** ele cria uma categoria informando nome, tipo de tamanho e, opcionalmente, a categoria pai, o slug, a posição e o guia de medidas (`POST /v1/admin/categories`)
- **Então** a categoria é criada (201) e passa a aparecer na árvore pública
- **E** sem slug informado, ele é gerado do nome (minúsculo, sem acento, com hífens: "Calçados Femininos" → `calcados-femininos`)

#### AC-027 — Dados inválidos são recusados com o motivo de cada campo

- **Dado** um admin logado
- **Quando** ele envia uma categoria sem nome, com tipo de tamanho desconhecido, com categoria pai inexistente ou com guia de medidas fora do formato
- **Então** nada é gravado e a resposta é 400 no formato padrão de erro, com a lista de campos inválidos (`errors`)
- **E** slug já usado por outra categoria é recusado com 409 e o código `SLUG_TAKEN`

#### AC-028 — Editar e mover categoria

- **Dado** um admin logado e uma categoria existente
- **Quando** ele muda o nome, o slug, a posição, o tipo de tamanho, o guia de medidas ou a categoria pai (`PATCH /v1/admin/categories/{id}`)
- **Então** a árvore pública passa a refletir a mudança
- **E** mover uma categoria para dentro dela mesma ou de uma descendente é recusado (422, código `INVALID_CATEGORY_PARENT`) sem alterar nada
- **E** criar ou mover uma categoria para dentro de uma categoria arquivada também é recusado (422, `INVALID_CATEGORY_PARENT`)

#### AC-029 — Arquivar categoria leva junto as subcategorias

- **Dado** um admin logado e uma categoria com subcategorias
- **Quando** ele arquiva a categoria (`DELETE /v1/admin/categories/{id}`)
- **Então** ela e todas as descendentes somem da árvore pública (204), mas continuam no banco marcadas como arquivadas (`archived_at`)
- **E** a lista do admin (`GET /v1/admin/categories`) continua mostrando as arquivadas, com a data em que foram arquivadas
- **E** o slug de uma categoria arquivada continua reservado (não pode ser reutilizado)
- **E** arquivar, restaurar ou editar uma categoria que não existe responde 404

#### AC-033 — Restaurar categoria arquivada

- **Dado** um admin logado e uma categoria arquivada cuja categoria pai está ativa (ou que é de primeiro nível)
- **Quando** ele restaura a categoria (`POST /v1/admin/categories/{id}/restore`)
- **Então** só ela volta para a árvore pública (200); as descendentes continuam arquivadas até serem restauradas uma a uma
- **E** restaurar uma categoria cuja pai está arquivada é recusado (422, código `INVALID_CATEGORY_PARENT`) sem alterar nada

### US-013 — Toda ação do admin fica registrada

Como dono da plataforma, quero saber quem mudou o quê e quando na área de
admin, para investigar problemas e prestar contas (RF-ADM-5).

#### AC-030 — Escrita do admin gera registro de auditoria com antes e depois

- **Dado** um admin logado
- **Quando** ele cria, edita, arquiva ou restaura uma categoria com sucesso
- **Então** fica gravado um registro de auditoria com quem fez, a ação (ex.: `category.update`), o tipo e o id da entidade, o estado antes e depois e o IP de origem
- **E** no arquivamento em cascata, o registro da categoria arquivada lista no "depois" os ids das descendentes arquivadas junto
- **E** leituras e tentativas recusadas (erro de validação, 404, falta de permissão) não geram registro

### US-014 — A API tem contrato publicado e o site usa tipos gerados dele

Como dev (e quem avalia o portfólio), quero a API documentada e o site tipado a
partir do mesmo contrato, para que uma mudança na API quebre o build do site, e
não a produção (ADR-0008).

#### AC-031 — Documentação interativa da API

- **Dado** a API rodando
- **Quando** alguém abre `/docs`
- **Então** vê a documentação interativa (Swagger UI) com as rotas de categorias, seus parâmetros, corpos e respostas
- **E** o contrato em JSON (OpenAPI 3) está em `/docs/openapi.json`, sem exigir login

#### AC-032 — Contrato desatualizado é detectado

- **Dado** o contrato OpenAPI e os tipos do cliente gerados e guardados no repositório (`packages/api-client`)
- **Quando** uma rota ou um formato da API muda sem que alguém rode `pnpm api:generate`
- **Então** um teste falha avisando que o contrato está desatualizado

## Fora de escopo

- Página de admin no site (árvore com arrastar e soltar, edição do guia de medidas) → Fase 4 (bônus). Nesta feature o admin usa a API (ou o Swagger em `/docs`).
- Páginas `/c/{slug}` com produtos (PLP) → feature `vitrine`. Até lá, o link do menu leva à página "não encontrada".
- Produtos ligados a categorias e o que acontece com os produtos de uma categoria arquivada → feature `produtos`.
- Papel `seller`, rotas `/seller/*` e checagem de posse (spec 01 H3) → feature `vendedores`.
- Espelhar papéis em `publicMetadata.roles` no Clerk (precisa do outbox) → Fase 2.
- Invalidação imediata do cache de papéis da API: um admin promovido pelo seed (outro processo) passa a ter acesso em até 60 s, quando o cache expira. A invalidação explícita entra em `vendedores`, quando o papel muda dentro da própria API.
- Consulta ao log de auditoria (`GET /admin/audit-logs`) → Fase 4 (painel admin completo).
- Cache e revalidação (`revalidateTag`) da árvore no site → feature `vitrine`.
- CI regenerando o contrato e falhando com diff (ADR-0008) → feature `ci-e-deploy`; aqui o teste do AC-032 cumpre esse papel.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-005 | Cada categoria tem um tipo de tamanho obrigatório: `CLOTHING` (PP–XGG), `SHOES` (33–46) ou `ONE_SIZE` (U). É ele que, na feature `produtos`, define a grade de tamanhos (spec 03). Campo novo, ainda fora do DATA_MODEL | confirmada | confirmado pelo dono do produto em 03/11/2026; o DATA_MODEL ganha `size_type` |
| ASM-006 | O slug é único na árvore inteira (DATA_MODEL), não só entre irmãs. Subcategorias com o mesmo nome em departamentos diferentes precisam de slug distinto (ex.: `vestidos-femininos`), informado pelo admin ou pelo seed | confirmada | confirmado pelo dono do produto em 03/11/2026 |
| ASM-007 | Remover categoria é exclusão definitiva, permitida só sem filhas | invalidada | o dono do produto escolheu arquivar (soft delete) em 03/11/2026: arquivar leva junto as descendentes e existe restaurar (AC-029, AC-033); o DATA_MODEL ganha `archived_at` |
| ASM-008 | O guia de medidas é uma tabela simples: `{ columns: string[], rows: string[][] }`, com cada linha do mesmo tamanho de `columns` (ex.: Tamanho, Busto, Cintura) | confirmada | confirmado pelo dono do produto em 03/11/2026 |
| ASM-009 | `/docs` e `/docs/openapi.json` ficam públicos também em produção: a documentação faz parte do portfólio e não expõe nada além do contrato | confirmada | confirmado pelo dono do produto em 03/11/2026 |
| ASM-010 | O cliente tipado usa `openapi-typescript` + `openapi-fetch` e os DTOs da API usam `nestjs-zod` + `@nestjs/swagger`, conforme a ADR-0008, desde que essas bibliotecas suportem as versões atuais (Nest 12, Zod 4) | invalidada | em 03/11/2026: o `nestjs-zod` 5.5 só suporta Nest 10/11 e `@nestjs/swagger` até 11. O dono do produto escolheu Zod 4 nativo (`z.toJSONSchema`) com pipe de validação e decorator próprios, registrando os schemas no `@nestjs/swagger` 12; `openapi-typescript` + `openapi-fetch` continuam no site |
| ASM-011 | Arquivar é em cascata (a categoria e todas as descendentes) e restaurar devolve só a categoria escolhida, exigindo a pai ativa | confirmada | escolhido pelo dono do produto em 03/11/2026 |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-002 | Como dividir a Fase 1 e o que entra em categorias? | respondida | Cinco features (categorias → vendedores → produtos → vitrine → busca). Em categorias: só API + seed (sem página de admin) e auditoria já nesta feature (decidido em 03/11/2026) |
