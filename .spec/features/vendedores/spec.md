| confirmada | confirmado pelo dono do produto em 14/11/2026; o roadmap foi atualizado || confirmada | confirmado pelo dono do produto em 14/11/2026 || confirmada | confirmado pelo dono do produto em 14/11/2026 || confirmada | confirmado pelo dono do produto em 14/11/2026 || confirmada | confirmado pelo dono do produto em 14/11/2026 || confirmada | confirmado pelo dono do produto em 14/11/2026 || confirmada | confirmado pelo dono do produto em 14/11/2026 || confirmada | confirmado pelo dono do produto em 14/11/2026 |# Spec: Vendedores — candidatura, chave Pix conferida e gestão das lojas

> feature: vendedores
> status: auditada

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

Segunda feature da Fase 1 do [roadmap](../../../docs/ROADMAP.md). Uma pessoa com conta na Vitrine pede para abrir uma loja. Na candidatura, ela cadastra a **chave Pix de recebimento**, e a API confere no Asaas se o titular da chave é o CPF/CNPJ da loja ([ADR-0012](../../../docs/adr/0012-repasse-por-pix-sem-subcontas.md); o adaptador `lookupPixKey` e a regra `assertPixKeyOwner` vieram da T-012). O admin aprova ou rejeita. Depois, pode suspender, reativar e definir uma comissão própria para a loja. A loja aprovada troca a chave Pix e configura o frete. No site, o vendedor tem a página de candidatura e a página "minha loja"; o admin usa a API (Swagger em `/docs`).

Esta feature também cumpre o que a spec 01 (H3) e a feature `categorias` deixaram para cá: o papel `seller`, as rotas `/seller/*` (que exigem loja aprovada) e a invalidação imediata do cache de papéis quando o papel muda dentro da API.

Decisões do dono do produto (14/11/2026):
- **Escopo:** além do núcleo, entram suspender e reativar, comissão por loja, configuração de frete e troca da chave Pix.
- **Telas:** só as do vendedor (candidatura e "minha loja").
- **Asaas fora do ar na candidatura:** recusa e pede para tentar depois; nada é gravado sem a chave conferida.
- **Documento:** uma loja por CPF/CNPJ.

Base: [PRD](../../../docs/PRD.md) (RF-SELLER-1, 2, 3 e 5, RF-ADM-1, RN-2, RN-3), [spec 02](../../../docs/specs/02-vendedores-e-onboarding.md) (H1 a H4), [spec 01](../../../docs/specs/01-identidade-e-acesso.md) (H3), [API](../../../docs/API.md) (`/seller/*`, `/admin/sellers`) e [DATA_MODEL](../../../docs/DATA_MODEL.md) (`sellers`, `shipping_settings`).

## Histórias

### US-017 — Quem quer vender pede para abrir uma loja

Como pessoa com conta na Vitrine, quero pedir para abrir uma loja informando os dados dela e a chave Pix onde vou receber, para começar a vender depois da aprovação.

#### AC-043 — Candidatura válida cria a loja em análise

- **Dado** uma pessoa logada, sem loja, e uma chave Pix cujo titular no Asaas tem o mesmo CPF da loja
- **Quando** ela envia a candidatura (`POST /v1/seller/application`) com nome da loja, bio, CPF/CNPJ, categoria principal, Instagram (opcional) e a chave Pix
- **Então** a loja é criada em análise (`PENDING`), com o slug sugerido a partir do nome (quando não informado), a chave Pix, o nome do titular e o documento mascarado devolvidos pelo Asaas, e a data da conferência
- **E** a pessoa ainda não ganha o papel `seller`

#### AC-044 — Dados inválidos são recusados com o motivo de cada campo

- **Dado** uma candidatura com CPF/CNPJ de dígitos verificadores inválidos, ou categoria principal inexistente ou arquivada, ou slug já usado por outra loja
- **Quando** ela é enviada
- **Então** o documento e a categoria inválidos respondem 400 (`VALIDATION_FAILED`, com o campo), e o slug ocupado responde 409 (`SLUG_TAKEN`)
- **E** nada é gravado, e o Asaas não é consultado

#### AC-045 — Chave Pix de outro titular, ou que não existe, é recusada

- **Dado** uma candidatura cuja chave Pix pertence a outro CPF/CNPJ, ou que não existe no diretório do Pix
- **Quando** ela é enviada
- **Então** a resposta é 422, com `PIX_KEY_OWNER_MISMATCH` ou `PIX_KEY_NOT_FOUND`
- **E** nada é gravado

#### AC-046 — Sem resposta do Asaas, a candidatura espera

- **Dado** que o Asaas está fora do ar ou responde com erro na consulta da chave Pix
- **Quando** uma candidatura é enviada
- **Então** a resposta é 503 (`PIX_KEY_CHECK_UNAVAILABLE`), pedindo para tentar de novo mais tarde
- **E** nada é gravado

#### AC-047 — Uma candidatura ativa por conta; nova só 7 dias depois da rejeição

- **Dado** uma pessoa com loja em análise, aprovada ou suspensa, ou rejeitada há menos de 7 dias
- **Quando** ela envia outra candidatura
- **Então** a resposta é 409 (`SELLER_APPLICATION_EXISTS`); para a rejeitada, com a data a partir da qual pode tentar de novo
- **E** rejeitada há 7 dias ou mais, a nova candidatura é aceita e a mesma loja volta para `PENDING`, com os dados novos

#### AC-048 — Uma loja por CPF/CNPJ, com o documento guardado criptografado

- **Dado** uma loja já cadastrada com o CPF `111.444.777-35`
- **Quando** outra conta envia uma candidatura com o mesmo documento (com ou sem pontuação)
- **Então** a resposta é 409 (`DOCUMENT_TAKEN`), e nada é gravado
- **E** no banco, o documento da loja não aparece em texto puro

#### AC-049 — A pessoa acompanha a própria candidatura

- **Dado** uma pessoa logada com candidatura
- **Quando** ela consulta a situação (`GET /v1/seller/application`)
- **Então** recebe a situação, os dados da loja, o titular da chave Pix conferida (nome e documento mascarado), o motivo e a data de nova tentativa (se rejeitada) e o checklist "dados da loja · chave Pix · frete"
- **E** sem candidatura, a resposta é 404

### US-018 — O admin decide quem vende

Como admin, quero ver as candidaturas com o titular da chave Pix já conferido, e aprovar ou rejeitar cada uma, para só deixar vender quem eu conferi.

#### AC-050 — Admin lista as lojas por situação

- **Dado** lojas em análise, aprovadas, rejeitadas e suspensas
- **Quando** o admin lista (`GET /v1/admin/sellers?status=PENDING`)
- **Então** recebe só as da situação pedida, da mais antiga para a mais nova, com nome, slug, CPF/CNPJ completo, conta dona, chave Pix, titular conferido (nome e documento mascarado) e data da conferência
- **E** quem não é admin recebe 404, como em toda a área de admin

#### AC-051 — Aprovar dá o papel de vendedor na hora

- **Dado** uma loja em análise
- **Quando** o admin aprova (`POST /v1/admin/sellers/{id}/approve`)
- **Então** a loja fica `APPROVED`, com a data de aprovação, e a dona ganha o papel `seller`, já valendo na próxima chamada dela à API (sem esperar o cache de 60 s)
- **E** a decisão fica no registro de auditoria (`seller.approve`)

#### AC-052 — Rejeitar exige motivo; decisão fora de hora é recusada

- **Dado** uma loja em análise
- **Quando** o admin rejeita (`POST /v1/admin/sellers/{id}/reject`) com um motivo
- **Então** a loja fica `REJECTED`, com o motivo e a data, e a decisão vai para a auditoria (`seller.reject`)
- **E** rejeitar sem motivo responde 400, e aprovar ou rejeitar uma loja que não está em análise responde 422 (`INVALID_STATE_TRANSITION`)

### US-019 — O admin suspende e reativa lojas

Como admin, quero suspender uma loja aprovada (e reativá-la depois), para tirar de circulação uma loja com problema sem apagar nada.

#### AC-053 — Suspender e reativar, sempre com registro

- **Dado** uma loja aprovada
- **Quando** o admin a suspende (`POST /v1/admin/sellers/{id}/suspend`) com um motivo, e depois a reativa (`POST /v1/admin/sellers/{id}/reinstate`)
- **Então** a loja passa a `SUSPENDED` e depois volta a `APPROVED`, e as duas decisões vão para a auditoria (`seller.suspend`, `seller.reinstate`)
- **E** suspender sem motivo responde 400; suspender loja que não está aprovada, ou reativar loja que não está suspensa, responde 422 (`INVALID_STATE_TRANSITION`)

### US-020 — O admin define a comissão de uma loja

Como admin, quero definir uma comissão diferente da padrão para uma loja, para negociar condições com parceiros.

#### AC-054 — Comissão própria ou volta à padrão

- **Dado** uma loja
- **Quando** o admin define a comissão (`PATCH /v1/admin/sellers/{id}/commission`) em pontos-base (ex.: `800` = 8%), ou `null` para voltar à padrão
- **Então** a loja passa a mostrar a comissão definida (ou a padrão, de 12%), e a mudança vai para a auditoria com o valor antes e depois (`seller.commission`)
- **E** valor fora de 0 a 10000 responde 400

### US-021 — A loja aprovada mantém a chave Pix e o frete

Como vendedor, quero trocar a minha chave Pix e configurar o frete da minha loja, para receber no lugar certo e cobrar o frete certo.

#### AC-055 — A área do vendedor é só da loja aprovada

- **Dado** uma pessoa sem loja, com loja em análise ou rejeitada, e outra com loja suspensa
- **Quando** elas chamam uma rota da área do vendedor (ex.: `GET /v1/seller/pix-key`)
- **Então** quem não tem o papel `seller` recebe 404, como se a rota não existisse
- **E** a loja suspensa recebe 403 (`SELLER_NOT_ACTIVE`)

#### AC-056 — Trocar a chave Pix confere o titular de novo

- **Dado** uma loja aprovada com uma chave Pix conferida
- **Quando** o vendedor envia uma chave nova (`PUT /v1/seller/pix-key`)
- **Então** com o titular certo, a chave nova passa a valer (com o titular e a data da nova conferência), e a troca vai para a auditoria (`seller.pix_key_change`), com a chave antiga e a nova
- **E** com titular errado, chave inexistente ou o Asaas fora do ar, a resposta é a mesma da candidatura (422 ou 503), e a chave antiga continua valendo

#### AC-057 — Configurar o frete da loja

- **Dado** uma loja aprovada
- **Quando** o vendedor envia a configuração de frete (`PUT /v1/seller/shipping`): CEP de origem, valor para cada região (N, NE, CO, SE, S), frete grátis acima de um valor (opcional) e prazo de manuseio de 1 a 5 dias
- **Então** a configuração fica salva, volta igual em `GET /v1/seller/shipping`, e o item "frete" do checklist fica pronto
- **E** CEP sem 8 dígitos, região faltando, valor negativo ou prazo fora de 1 a 5 respondem 400, com o campo

### US-022 — O vendedor tem telas no site

Como pessoa que quer vender, quero me candidatar e acompanhar a minha loja pelo site, sem precisar usar a API.

#### AC-058 — Página de candidatura

- **Dado** uma pessoa logada, sem loja
- **Quando** ela abre `/vender`, preenche o formulário e envia
- **Então** com sucesso, ela vai para `/minha-loja`, que mostra "em análise"
- **E** com erro, a mensagem aparece junto ao campo (ex.: "Esta chave Pix não está no CPF/CNPJ da loja" na chave Pix), e o que ela digitou continua no formulário

#### AC-059 — Página "minha loja"

- **Dado** uma pessoa logada
- **Quando** ela abre `/minha-loja`
- **Então** vê a situação da loja (em análise, aprovada, rejeitada com o motivo e a data para tentar de novo, ou suspensa), o titular da chave Pix conferida e o checklist
- **E** sem loja, vê um convite com link para `/vender`; sem login, vai para o login, como as outras áreas privadas

## Fora de escopo

- Telas de admin no site (lista de candidaturas com aprovar e rejeitar) → Fase 4 (bônus). Aqui o admin usa a API ou o Swagger em `/docs`.
- Telas de troca da chave Pix e de frete no site → por ora, só pela API (ASM-020).
- Avisos por e-mail (aprovação, rejeição, troca de chave) → Fase 2, com o Resend e o outbox (ASM-015).
- Espelhar o papel `seller` em `publicMetadata.roles` no Clerk (spec 01 H3, via outbox) → Fase 2.
- Página pública da loja (`/loja/{slug}`) → feature `vitrine`. O que acontece com os produtos de loja suspensa → feature `produtos`.
- Cálculo do frete no carrinho e no checkout → Fase 2 (usa a configuração daqui). A comissão por loja só é usada no checkout (Fase 2).
- Dashboard do vendedor (H6) → Fase 4 (bônus).
- Editar os dados da loja depois de aprovada (`PATCH /seller/me`: nome, bio, logo, banner) → feature `vitrine`, junto com a página pública.
- Repasse retido quando a chave deixou de existir no Asaas (spec 02 H3) → Fase 3, com o job de repasse.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-015 | Os avisos por e-mail ao vendedor (aprovação, rejeição, troca de chave) ficam para a Fase 2, com o Resend e o outbox; nesta feature, a situação aparece em `/minha-loja` | confirmada | confirmado pelo dono do produto em 14/11/2026 |
| ASM-016 | O CPF/CNPJ é guardado criptografado (AES-256-GCM, chave em `SELLER_DOCUMENT_KEY`), e a regra "uma loja por documento" usa um hash do documento só com dígitos (HMAC-SHA256), com índice único | confirmada | confirmado pelo dono do produto em 14/11/2026 |
| ASM-017 | O admin vê o CPF/CNPJ completo na lista de lojas (para conferir a identidade); para o próprio vendedor e no site, ele aparece mascarado | confirmada | confirmado pelo dono do produto em 14/11/2026 |
| ASM-018 | A comissão por loja aceita de 0 a 10000 pontos-base (0% a 100%); `null` volta à padrão de 12% (RN-3) | confirmada | confirmado pelo dono do produto em 14/11/2026 |
| ASM-019 | Trocar a chave Pix e configurar o frete exigem loja aprovada (spec 01 H3); loja em análise ou suspensa não altera. A chave cadastrada na candidatura é a que o admin confere | confirmada | confirmado pelo dono do produto em 14/11/2026 |
| ASM-020 | Nas telas do site, o vendedor só se candidata e acompanha a loja; trocar a chave Pix e configurar o frete ficam pela API (`/docs`) nesta feature | confirmada | confirmado pelo dono do produto em 14/11/2026 |
| ASM-021 | A categoria principal pode ser qualquer categoria ativa da árvore, não só um departamento | confirmada | confirmado pelo dono do produto em 14/11/2026 |
| ASM-022 | A configuração de frete da loja sai da Fase 2 do roadmap e entra aqui; o cálculo no carrinho continua na Fase 2 | confirmada | confirmado pelo dono do produto em 14/11/2026; o roadmap foi atualizado |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-005 | O que entra em vendedores, além de candidatura, chave Pix e aprovação? | respondida | Suspender e reativar, comissão por loja, configuração de frete e troca da chave Pix (decidido em 14/11/2026) |
| Q-006 | Quais telas a feature entrega? | respondida | As do vendedor: candidatura e "minha loja". O admin usa o `/docs` (decidido em 14/11/2026) |
| Q-007 | O que acontece se o Asaas não responder na hora da candidatura? | respondida | Recusa com 503 e não grava nada; a pessoa tenta de novo depois (decidido em 14/11/2026) |
| Q-008 | Um mesmo CPF/CNPJ pode ter mais de uma loja? | respondida | Não: uma loja por documento (decidido em 14/11/2026) |
