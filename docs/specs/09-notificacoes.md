# Spec 09 — Notificações

**Requisitos:** RF-ENG-4 · RNF-5 · **Módulo Nest:** `notifications` · **Pacote:** `packages/emails`

## Objetivo
Manter comprador, vendedor e admin informados por e-mail transacional, disparado de forma assíncrona e confiável a partir de eventos de domínio.

## Arquitetura
- Worker pg-boss consome eventos da outbox e mapeia evento → template(s) → destinatários.
- Templates em React Email (`packages/emails`), pré-visualizáveis com `email dev`.
- Envio via porta `Mailer` (adapter Resend; adapter `ConsoleMailer` em dev/test).
- Idempotência: chave `notification:{eventId}:{template}:{recipient}` registrada antes do envio.
- Retry exponencial (5×), depois fila de *dead letter* do pg-boss, visível no admin.
- Preferências: e-mails de marketing (baixa de preço) com opt-out; transacionais sempre enviados.

## Catálogo

| Evento | Destinatário | Template |
|---|---|---|
| `SellerApproved` / `SellerRejected` | vendedor | Loja aprovada (com link de onboarding) / Candidatura recusada |
| `SellerPixKeyChanged` | vendedor | Chave Pix de recebimento alterada (aviso de segurança) |
| `PayoutFailed` | vendedor | Repasse não enviado: confira a chave Pix |
| `OrderPaid` | comprador | Pedido confirmado (resumo por loja) |
| `OrderPaid` | cada vendedor | Nova venda — despache até {data} |
| `OrderExpired` | comprador | Pagamento não concluído |
| `ShipDeadlineApproaching` | vendedor | Prazo de envio vence amanhã |
| `SellerOrderShipped` | comprador | Seu pedido da {loja} foi enviado |
| `SellerOrderDelivered` | comprador | Como foi? Avalie sua compra |
| `SellerOrderCanceled` | comprador / vendedor | Cancelamento e reembolso |
| `ReturnRequested` | vendedor | Nova solicitação de devolução |
| `ReturnApproved` / `ReturnRejected` | comprador | Atualização da devolução |
| `RefundIssued` | comprador | Reembolso de R$ X processado |
| `PayoutReleased` | vendedor | Repasse de R$ X enviado |
| `ChargebackOpened` | admin, vendedores | Chargeback aberto no pedido {n} |
| `PriceDropped` | comprador (opt-in) | Um favorito baixou de preço |
| `DataExportReady` | usuário | Seus dados estão prontos |

## Critérios de aceite
- Todo e-mail tem versão texto, link para o recurso no site, e rodapé com identificação da plataforma.
- Valores formatados `pt-BR` (`Intl.NumberFormat`), datas em `America/Sao_Paulo`.
- Teste de snapshot por template; teste de integração verifica que `OrderPaid` gera 1 e-mail ao comprador + 1 por loja.
