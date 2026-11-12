# Spec: Spike Asaas — adaptador de pagamento provado no sandbox

> feature: spike-asaas
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

O pagamento da Vitrine passou do Stripe para o Asaas ([ADR-0011](../../../docs/adr/0011-asaas-subcontas-e-transferencias.md),
12/11/2026). Antes de construir vendedores e checkout em cima dele, este spike
prova no **sandbox** do Asaas cada passo do dinheiro e deixa pronto o adaptador
de produção (`AsaasGateway`, atrás da porta `PaymentGateway`), com testes de
contrato que **gravam** as respostas reais do sandbox e depois as **reproduzem**
(rápidos, sem rede e sem chave no dia a dia). Também deixa pronto o endereço
que recebe os avisos (webhooks) do Asaas com segurança.

O que a ADR-0011 deixou "a validar" é respondido no relatório
[docs/spikes/asaas.md](../../../docs/spikes/asaas.md), produzido por este spike.

Decisões do dono do produto (12/11/2026): entregar o adaptador real com testes
no sandbox (não um roteiro descartável), testes que gravam e reproduzem as
respostas do Asaas, e sem captura real de webhooks neste spike.

## Histórias

### US-015 — A Vitrine fala com o Asaas por um adaptador testado no sandbox

Como dev, quero um adaptador de pagamento que já funcione contra o sandbox do
Asaas, para construir vendedores, checkout e repasse sobre comportamento
comprovado, e não sobre suposições da documentação.

#### AC-034 — Subconta da loja criada uma única vez

- **Dado** os dados completos de uma loja de teste (nome, e-mail, CPF, celular, faturamento e endereço)
- **Quando** o adaptador cria a subconta no sandbox, e depois tenta criar de novo com os mesmos dados
- **Então** a primeira chamada devolve o id da subconta e o `walletId`
- **E** a segunda não cria outra subconta: devolve a mesma (procura pelo e-mail antes de criar)

#### AC-035 — Pix cobrado na conta da plataforma e recebido

- **Dado** um comprador de teste
- **Quando** o adaptador cria uma cobrança Pix de R$ 50,00 na conta da plataforma (sem split) e o recebimento é simulado no sandbox
- **Então** o adaptador lê a cobrança como recebida (`RECEIVED`), com o valor líquido e a data do recebimento
- **E** o saldo disponível da plataforma aumenta

#### AC-036 — Cartão aprovado fica confirmado; cartão recusado vira erro claro

- **Dado** um comprador de teste
- **Quando** o adaptador cobra com o cartão de teste de aprovação e, depois, com o de recusa
- **Então** a cobrança aprovada fica confirmada (`CONFIRMED`), mas ainda não recebida (dinheiro do cartão em D+32)
- **E** a recusa vira um erro de domínio (`PAYMENT_DECLINED`), sem estourar erro genérico

#### AC-037 — Checkout hospedado criado com Pix e cartão

- **Dado** um pedido de teste com valor e prazo de expiração
- **Quando** o adaptador cria o Checkout hospedado
- **Então** recebe o id e o endereço da página de pagamento do Asaas, aceitando Pix e cartão
- **E** o pedido fica ligado ao Checkout (`externalReference` = id do pedido)

#### AC-038 — Repasse transferido para a subconta uma única vez

- **Dado** saldo disponível na plataforma e a subconta da loja de teste
- **Quando** o adaptador transfere R$ 10,00 para o `walletId` da loja, e a mesma transferência é pedida de novo
- **Então** a transferência fica concluída (ou em processamento) e o saldo da plataforma diminui R$ 10,00
- **E** o pedido repetido não transfere duas vezes

#### AC-039 — Estorno parcial de um Pix recebido

- **Dado** uma cobrança Pix recebida
- **Quando** o adaptador estorna parte do valor, e depois tenta estornar mais do que sobrou
- **Então** o estorno parcial é aceito e o valor estornado aparece na cobrança
- **E** o excesso é recusado com um erro de domínio (`REFUND_NOT_ALLOWED`)

### US-016 — Os avisos do Asaas chegam com segurança

Como plataforma, quero aceitar só os avisos que vieram mesmo do Asaas e
processar cada um uma vez, para que ninguém consiga marcar um pedido como pago
mandando um aviso falso.

#### AC-040 — Aviso sem o token certo é recusado

- **Dado** um aviso sem o cabeçalho `asaas-access-token`, ou com um token diferente do configurado
- **Quando** ele chega em `POST /v1/webhooks/asaas`
- **Então** a resposta é 401 no formato padrão de erro
- **E** nada é gravado

#### AC-041 — Aviso de pagamento é registrado e conferido na API do Asaas

- **Dado** um aviso de pagamento recebido no formato documentado pelo Asaas, com o id de um pagamento real do sandbox e o token certo
- **Quando** ele chega em `POST /v1/webhooks/asaas`
- **Então** o evento é registrado uma vez (pelo id do evento do Asaas) e respondido com 200
- **E** o estado do pagamento é buscado na API do Asaas, e não lido do conteúdo do aviso

#### AC-042 — Aviso repetido não é processado de novo

- **Dado** um aviso já processado
- **Quando** o Asaas manda o mesmo aviso de novo
- **Então** a resposta é 200
- **E** o evento não é processado nem consultado na API de novo

## Fora de escopo

- Candidatura, aprovação de loja e páginas do vendedor → feature `vendedores` (usa o `createSubaccount` daqui).
- Fluxo de checkout com pedido, reserva de estoque e reação ao pagamento → Fase 2 (usa o `createCheckout` e o webhook daqui).
- Ledger, job de repasse e dívida da loja → Fase 3 (usa `transfer` e `refund` daqui).
- Chargeback: o sandbox não simula sozinho (só a pedido do suporte); fica para a Fase 3, com o evento documentado no relatório.
- Webhook ligado a regras de negócio (marcar pedido pago etc.): aqui ele só autentica, registra e reconsulta.
- Captura de avisos reais do Asaas (túnel ou serviço externo) → Fase 2, junto com o checkout.
- Regravar as respostas do sandbox no CI → não previsto: regrava-se localmente com `ASAAS_RECORD=1` quando o Asaas mudar.

## Suposições

<!-- O que estamos ASSUMINDO sem confirmação. Status: aberta | confirmada | invalidada -->

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-012 | Os testes de contrato rodam contra o sandbox de verdade sempre que a suíte roda | invalidada | o dono do produto escolheu, em 12/11/2026, gravar e reproduzir: com `ASAAS_RECORD=1` os testes batem no sandbox e gravam as respostas (sem chaves) em `test/fixtures/asaas`; nas demais rodadas, reproduzem essas respostas, sem rede e sem chave |
| ASM-013 | Para respeitar o limite de 20 subcontas por dia do sandbox, os testes usam sempre a mesma loja de teste (mesmo e-mail), criada só na primeira execução | confirmada | confirmado pelo dono do produto em 12/11/2026 |
| ASM-014 | O túnel `cloudflared` é instalado na máquina do dono do produto para capturar os avisos reais durante o spike | invalidada | o dono do produto escolheu, em 12/11/2026, não capturar avisos reais agora: os exemplos seguem o formato da documentação, com ids de pagamentos reais do sandbox; a captura fica para a Fase 2 |

## Perguntas em aberto

<!-- O que ainda não sabemos. Status: aberta | respondida -->

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-003 | O que o spike entrega e como capturar os webhooks reais? | respondida | Adaptador de produção com testes de contrato que gravam e reproduzem o sandbox; sem captura real de webhooks agora (decidido em 12/11/2026) |
