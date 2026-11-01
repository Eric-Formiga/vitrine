# ADR-0005 — Stripe Connect Express com *separate charges and transfers*

**Status:** Aceita · **Data:** 2026-10-19

## Contexto
Um carrinho pode conter itens de várias lojas e deve ser pago numa única cobrança. A plataforma precisa reter comissão, segurar o dinheiro até a entrega + janela de arrependimento, e reembolsar parcialmente por loja.

## Decisão
- **Contas Express** para vendedores (Stripe cuida de KYC, dashboard e payouts bancários).
- Modelo de cobrança **separate charges and transfers**: PaymentIntent na conta da plataforma com `transfer_group = orderId`; um `Transfer` por sub-pedido para a conta da loja, com `source_transaction`, criado só quando o repasse é liberado.
- Reembolsos na cobrança da plataforma; quando o repasse já ocorreu, `transfer reversal` do valor correspondente à loja.
- Payment Element (embutido) em vez de Stripe Checkout hospedado, para UX própria.

## Alternativas
- **Destination charges** (`transfer_data.destination`): suporta apenas **um** destino por cobrança — inviável para carrinho multi-loja sem dividir o pagamento.
- **Direct charges**: cobrança na conta do vendedor; exigiria uma cobrança por loja (comprador paga N vezes).
- **Custom accounts**: controle total da UX de onboarding, mas a plataforma assume KYC e suporte.
- **Uma cobrança por loja**: simplifica repasse, piora a UX e multiplica taxas.

## Consequências
- (+) Uma cobrança para N lojas; controle fino do momento do repasse; comissão implícita (repassa menos).
- (−) A plataforma é *merchant of record*: arca com taxas Stripe e é responsável por disputas → ledger e regras de bloqueio/estorno de repasse (spec 07).
- (−) Fundos ficam no saldo da plataforma até o repasse; o Stripe limita esse período, o que é compatível com os prazos do projeto (≈ 30 dias no pior caso).
- **Risco a validar no spike da Fase 0:** disponibilidade de Connect (e Pix) para plataforma brasileira em produção. O projeto roda em **modo teste**, onde o fluxo é demonstrável; o README documentará o que mudaria em produção.
