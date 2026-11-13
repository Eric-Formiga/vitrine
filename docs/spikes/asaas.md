# Spike Asaas: relatório

**Feature:** `spike-asaas` (T-012 a T-015) · **Período:** 12 e 13/11/2026 · **Ambiente:** sandbox do Asaas, conta de pessoa física

Este relatório responde o que a [ADR-0011](../adr/0011-asaas-subcontas-e-transferencias.md) e a [ADR-0012](../adr/0012-repasse-por-pix-sem-subcontas.md) deixaram "a validar". Também registra onde o sandbox se comportou diferente da documentação. Cada afirmação marcada como **observado** tem uma gravação real do sandbox em `apps/api/test/fixtures/asaas/`, reproduzida pelos testes de contrato em `apps/api/test/asaas-gateway.e2e-spec.ts`.

## O que ficou pronto

- **Porta `PaymentGateway` e adaptador `AsaasGateway`** (`apps/api/src/modules/payments`). Operações: consulta de titular de chave Pix, comprador, cobrança Pix, leitura da cobrança, Checkout hospedado, saldo, estorno e transferência Pix idempotente. Os tipos são da Vitrine (centavos, situações próprias).
- **Webhook** `POST /v1/webhooks/asaas`:
  - aceita só avisos com o token certo, comparado em tempo constante;
  - grava cada aviso uma vez em `asaas_events`;
  - busca o estado do objeto na API do Asaas, sem ler o conteúdo do aviso;
  - um aviso que falha no meio é refeito no reenvio.
- **Testes de contrato com cassete:** com `ASAAS_RECORD=1`, gravam o sandbox real, sem chaves nem tokens de cartão; nas outras rodadas, reproduzem as gravações sem rede. Na reprodução, o cassete confere também o corpo enviado.

## Respostas ao que estava "a validar"

| Questão (ADR) | Resposta | Base |
|---|---|---|
| Aprovação automática de subconta no sandbox (0011) | **Não se aplica:** a conta PF recebe `403`, "Contas de pessoa física (CPF) não podem criar subcontas". O repasse passou a ser por Pix (ADR-0012). | observado (12/11) |
| Checkout com Pix + cartão e expiração de 15 min (0011) | **Sim.** `POST /v3/checkouts` com `billingTypes: [PIX, CREDIT_CARD]`, `minutesToExpire: 15` e `externalReference` nasce `ACTIVE`. O link vem como `https://sandbox.asaas.com/000/checkoutSession/show/<id>`, diferente do exemplo da documentação (sem o `/000`). | observado |
| Nomes e ordem dos eventos (0011) | **Nomes, pela documentação:** `PAYMENT_*` (ex.: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`), `CHECKOUT_PAID` / `CHECKOUT_CANCELED` / `CHECKOUT_EXPIRED`, e `TRANSFER_CREATED` / `TRANSFER_PENDING` / `TRANSFER_IN_BANK_PROCESSING` / `TRANSFER_BLOCKED` / `TRANSFER_DONE` / `TRANSFER_FAILED` / `TRANSFER_CANCELLED`. O objeto vem em `payment`, `checkout` ou `transfer`, e o id do evento em `id`. **A ordem não foi validada:** neste spike não houve captura de avisos reais (ASM-014); ela fica para a Fase 2, com um túnel. | documentação |
| Transferência e sua idempotência (0011/0012) | **Funciona, mas o filtro do Asaas não.** `GET /v3/transfers?externalReference=` **ignora o filtro** e devolve todas as transferências. O adaptador percorre as páginas e compara a referência ele mesmo. | observado (13/11) |
| Estorno parcial de Pix e cartão (0011) | **Pix: sim, com espera.** Logo após o recebimento, o Asaas recusa ("Tente novamente em alguns instantes") e aceita uns 4 s depois. O estorno nasce `AWAITING_CRITICAL_ACTION_AUTHORIZATION`. Estornar mais do que sobrou é recusado ("O valor total a ser estornado é superior ao valor do crédito"). **Cartão: não testado.** | observado |
| Custo das transferências (0011) | **Zero no sandbox** (`transferFee: 0`, saldo debitado só pelo valor). Em produção depende do plano. | observado |
| Quando a transferência sai de `PENDING` para `DONE` (0012) | **Não saiu.** As 5 transferências do spike seguem `PENDING` com `authorized: false`. A conta exige autorização de "ação crítica". Pela documentação, no sandbox ela se conclui com o token `000000`, ou o suporte pode desligar a exigência. **Pendente:** validar o caminho até `DONE` antes da Fase 3. | observado + documentação |
| Eventos `TRANSFER_*` (0012) | Nomes listados acima, pela documentação. Não capturados. | documentação |
| Chave de outro titular (0012) | **Não testado:** o sandbox só deixa consultar a chave de teste `47996515839`. A conferência do titular é uma regra pura, testada no domínio (`pix-key.spec.ts`). | — |

## Diferenças entre o sandbox e a documentação

1. **Os cartões de recusa não recusam.** `5184019740373151` (Mastercard) e `4916561358240741` (Visa) foram **aprovados**, e um número inválido no algoritmo de Luhn também. A única recusa reproduzível foi o **cartão vencido**: `400 invalid_creditCard`, "O cartão informado está expirado.". Ele virou o caso de recusa do AC-036.
2. **O filtro `externalReference` das transferências é ignorado** (veja a tabela). A ADR-0012 registrava esse filtro como confirmado; era um falso positivo, porque havia uma transferência só.
3. **Transferência repetida é bloqueada pelo Asaas.** Mesmo valor para a mesma chave Pix no mesmo dia volta `409 checkout.already.requested`, "Saque <id> já solicitado", **mesmo com outra `externalReference`**. Com outro valor, outra chave ou em outro dia, passa.
4. **Estorno não é imediato após o recebimento** (~4 s de espera).
5. **Saídas de dinheiro aguardam autorização.** Estornos (`AWAITING_CRITICAL_ACTION_AUTHORIZATION`) e transferências (`PENDING`, `authorized: false`) ficam parados até a autorização, mas o saldo é debitado **na criação**.

## Números observados

| Operação | Valor | Líquido | Situação | Crédito |
|---|---|---|---|---|
| Pix recebido (simulado) | R$ 50,00 | R$ 49,01 | `RECEIVED` | na hora; o saldo sobe exatamente o líquido |
| Cartão aprovado | R$ 89,90 | R$ 87,63 | `CONFIRMED` | previsto para D+32 (13/11 → 15/12) |
| Transferência Pix | R$ 10,00 | R$ 10,00 | `PENDING` | saldo debitado na criação, sem taxa |

## Impacto nas próximas fases

- **Fase 2 (checkout):**
  - o pedido é marcado como pago pelo aviso do Asaas, conferido na API (`getPayment`), e não pela volta do comprador à página de sucesso;
  - a captura de avisos reais (túnel) entra aqui, para validar a ordem dos eventos e o formato dos avisos de checkout.
- **Fase 3 (repasse):**
  - **Um repasse por loja por dia, somando os sub-pedidos elegíveis.** Assim, dois repasses de mesmo valor para a mesma loja no mesmo dia não batem no `409`. A referência passa a identificar o lote (ex.: `payout:<loja>:<data>`).
  - **A idempotência começa no banco da Vitrine.** O repasse é gravado como "enviando" antes da chamada e guarda o id da transferência depois. A busca pela referência no Asaas cobre só a falha entre as duas coisas.
  - **Antes de qualquer repasse real**, validar o caminho de `PENDING` até `DONE`, com a autorização de ação crítica e os eventos `TRANSFER_*`.
- **Devoluções (spec 07):** o estorno precisa tolerar a recusa temporária logo após o recebimento (tentar de novo pela fila) e o estado "aguardando autorização".
