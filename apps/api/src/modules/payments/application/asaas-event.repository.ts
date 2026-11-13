// Registro dos avisos do Asaas (um por id de evento). Porta: o caso de uso não conhece o Prisma.
export interface AsaasEventRepository {
  /**
   * Grava o aviso se ainda não existe (o id do evento é a chave) e diz se ele já tinha
   * sido processado. Um aviso gravado mas não processado (falha no meio) volta como
   * não processado, para ser refeito.
   */
  register(event: { id: string; type: string }): Promise<{ alreadyProcessed: boolean }>;
  markProcessed(eventId: string): Promise<void>;
}

export const ASAAS_EVENT_REPOSITORY = Symbol('ASAAS_EVENT_REPOSITORY');
