# Spec 10 — Painel administrativo

**Requisitos:** RF-ADM-1..5, RF-CAT-4 · **Módulo Nest:** `admin` (orquestra serviços dos demais módulos)

## Objetivo
Dar à operação da plataforma controle sobre lojas, conteúdo, dinheiro e saúde do marketplace, com toda ação sensível auditada.

## Seções

### Visão geral (`/admin`)
- KPIs do período: GMV, receita de comissão líquida (comissão − cupons de plataforma − taxas estimadas), pedidos pagos, ticket médio, lojas ativas, taxa de devolução, chargebacks abertos.
- Gráfico de GMV diário; top lojas por GMV.
- Fila de trabalho: candidaturas pendentes, devoluções escaladas, chargebacks com prazo, repasses com falha, lojas com saldo devedor, jobs em *dead letter*.
- Saúde das filas: pendentes, em execução, falhas e *dead letter* por fila (consulta ao schema `pgboss`), com ação de reprocessar.

### Lojas
- Lista filtrável (status, chave Pix conferida, data); detalhe mostra o titular da chave Pix devolvido pelo Asaas; detalhe com dados, documentos, métricas (vendas, atraso, cancelamento, devolução, nota), histórico de auditoria.
- Ações: aprovar, rejeitar (motivo), suspender (motivo, opção de ocultar produtos), reativar, comissão customizada.

### Catálogo
- Categorias: árvore com arrastar-e-soltar para ordenar, guia de medidas por categoria (tabela editável).
- Produtos: busca global, suspender/reativar com motivo (vendedor notificado).
- Avaliações: fila de `PENDING_MODERATION` e denunciadas; ocultar/restaurar.

### Pedidos e financeiro
- Busca por número, e-mail do comprador, loja.
- Detalhe completo: timeline de eventos (inclusive webhooks recebidos), ledger por sub-pedido, links para a cobrança e as transferências no painel do Asaas.
- Reembolso manual; resolução de devoluções escaladas; lista de chargebacks com `evidence_due_by`.
- Relatório de reconciliação (divergências local × Asaas).

### Cupons de plataforma
- CRUD com métricas de uso e custo total.

### Configurações
- Comissão padrão, prazos (despacho, auto-entrega, janela de devolução, retenção de repasse) — valores em `platform_settings`, lidos com cache.

### Auditoria
- `audit_logs` pesquisável por ator, entidade, ação e período; mostra diff `before/after`.

## Regras
- Todas as ações de escrita do admin passam por um interceptor que grava `audit_logs` (ator, IP, diff).
- Ações destrutivas/financeiras pedem confirmação com digitação do identificador (ex.: número do pedido).
- Admin não pode alterar valores de pedidos já pagos — só reembolsar.

## Critérios de aceite
- Usuário sem papel `admin` recebe `404` em `/admin/*` (web e API).
- Toda ação listada acima aparece no log de auditoria com diff.
- KPIs batem com uma query de verificação em teste de integração com dados de seed.
