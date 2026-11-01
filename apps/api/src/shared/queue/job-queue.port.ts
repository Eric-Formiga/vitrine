// Porta das filas: os casos de uso dependem desta interface, não do pg-boss.
// Para escalar, dá para trocar o adapter (ex.: BullMQ + Redis) sem mexer neles (ADR-0009).
export interface JobQueue {
  /** Enfileira um job; devolve o id dele. */
  send(queue: string, data: object): Promise<string | null>;
  /** Registra quem processa a fila. Só consome se RUN_WORKER=true. Chame no onModuleInit. */
  work<T = unknown>(queue: string, handler: (data: T) => Promise<void>): void;
  /** true quando as filas estão conectadas e prontas. */
  isReady(): boolean;
}

export const JOB_QUEUE = Symbol('JOB_QUEUE');
