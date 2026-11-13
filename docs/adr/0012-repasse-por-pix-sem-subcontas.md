# ADR-0012 — Repasse por Pix para a chave da loja, sem subcontas

**Status:** Aceita · **Data:** 2026-11-12 · Substitui a parte de subcontas da [ADR-0011](0011-asaas-subcontas-e-transferencias.md)

## Contexto
A ADR-0011 previa uma **subconta** do Asaas por loja, com o repasse transferido para o `walletId` dela. No spike (`spike-asaas`), o sandbox recusou a criação:

> "Contas de pessoa física (CPF) não podem criar subcontas no Asaas. Apenas contas de pessoa jurídica (CNPJ) podem acessar essa funcionalidade."

A conta do projeto é de pessoa física, e o dono do produto decidiu, em 12/11/2026, seguir **sem subcontas**. A mesma sondagem no sandbox mostrou que a conta PF consegue fazer o resto do caminho:
- **receber Pix:** cobrança de R$ 50,00, recebida e disponível na hora, com valor líquido de R$ 49,01;
- **transferir por Pix** para uma chave (`POST /v3/transfers` com `operationType: PIX`): o saldo é debitado na criação, sem taxa no sandbox, e a transferência nasce `PENDING`;
- ~~**buscar transferência pela `externalReference`** (`GET /v3/transfers?externalReference=`)~~. **Corrigido em 13/11/2026:** o filtro é ignorado e a listagem devolve todas as transferências. Na sondagem de 12/11 parecia funcionar porque havia uma só (veja a nota abaixo);
- **consultar o titular de uma chave Pix** (`GET /v3/pix/addressKeys/external?type=&key=`): devolve o nome e o CPF/CNPJ mascarado (`***.202.745-**`).

## Decisão
- **A loja cadastra uma chave Pix de recebimento** (CPF, CNPJ, e-mail, celular ou aleatória). Não há conta da loja no Asaas.
- **Conferência automática do titular:** ao cadastrar a chave, a API consulta o titular no Asaas e compara os **dígitos visíveis do documento mascarado** com o CPF/CNPJ da loja. Se não baterem, a chave é recusada. O nome do titular fica guardado e é mostrado ao admin na aprovação. Chave inexistente é recusada.
- **Repasse por transferência Pix** da conta da plataforma para a chave da loja, com `externalReference = payout:<id do sub-pedido>`. **Idempotência:** antes de transferir, procura uma transferência com a mesma `externalReference`; se existir, usa ela.
- O resto da ADR-0011 continua valendo: cobrança na conta da plataforma, Checkout hospedado com Pix e cartão, repasse só depois de entrega + 7 dias e com o pagamento recebido, devolução após o repasse como dívida da loja, e webhook com token, idempotência e reconsulta.

## Alternativas
- **Conta PJ no Asaas, mantendo as subcontas (ADR-0011):** o KYC das lojas fica com o Asaas, mas exige um CNPJ para a plataforma.
- **Pix ou conta bancária (TED):** cobre loja sem chave Pix, mas o TED é mais lento, pode ter taxa e não permite conferir o titular antes.
- **Só o admin confere o titular:** menos código, mais trabalho manual e mais risco de erro humano.

## Consequências
- (+) Funciona com a conta PF do projeto; o onboarding da loja fica mais simples (só a chave Pix), sem limite de subcontas e sem envio de documentos ao Asaas.
- (+) A idempotência do repasse usa a própria `externalReference` do Asaas.
- (−) **Sem KYC do provedor:** a plataforma passa a ser responsável por saber para quem paga. As camadas são a validação do CPF/CNPJ, a conferência do titular da chave e a aprovação manual do admin.
- (−) O dinheiro vai para fora do Asaas (o banco da loja). A loja não tem saldo nem extrato no Asaas; o extrato é o painel financeiro da Vitrine (spec 05).
- (−) Em produção, uma plataforma que recebe e repassa dinheiro de terceiros exige análise regulatória (arranjos de pagamento do Banco Central) e, provavelmente, uma conta PJ. Isso está fora do escopo do portfólio e fica documentado no README.
- (−) Em produção, transferências Pix podem ter tarifa conforme o plano do Asaas; ela entra no custo da plataforma (RN-4).
- **A validar no spike:** quando a transferência sai de `PENDING` para `DONE` no sandbox, os eventos `TRANSFER_*` e o comportamento com chave de outro titular.

## Nota de 13/11/2026: o que o spike mudou
O relatório completo está em [docs/spikes/asaas.md](../spikes/asaas.md).
- **A idempotência não pode confiar no filtro do Asaas.** `GET /v3/transfers?externalReference=` ignora o filtro. O adaptador (`AsaasGateway.transferPix`) percorre as páginas e compara a referência ele mesmo. A consequência "(+) a idempotência usa a própria `externalReference`" continua valendo, mas a comparação é feita do nosso lado.
- **O Asaas bloqueia transferência repetida:** mesmo valor para a mesma chave no mesmo dia volta `409 checkout.already.requested`, mesmo com outra referência; a Vitrine traduz para `PIX_TRANSFER_DUPLICATE`. Por isso, na Fase 3 o repasse deve ser **um por loja por dia**, somando os sub-pedidos elegíveis, com `externalReference = payout:<loja>:<data>`, em vez de um por sub-pedido. O registro do repasse no banco da Vitrine, gravado antes da chamada, é a primeira defesa contra pagar duas vezes.
- **`PENDING` → `DONE`: não validado.** As transferências ficam `PENDING` com `authorized: false` até a autorização de ação crítica (no sandbox, token `000000`). Validar antes da Fase 3.
- **Eventos `TRANSFER_*`:** nomes confirmados na documentação; não capturados neste spike.
- **Chave de outro titular:** não testada, porque o sandbox só deixa consultar a chave de teste.
