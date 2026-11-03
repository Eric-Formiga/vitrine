import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';

/** Quem está agindo, de onde, e qual ação auditada está em curso. */
export interface AuditContext {
  actorUserId: string;
  ip: string | null;
  action: string;
  recorded: number;
}

export interface AuditEntry {
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
}

/** Cliente do Prisma ou a transação em curso: o registro entra junto com a mudança. */
export type AuditWriter = Pick<Prisma.TransactionClient, 'auditLog'>;

// Trilha de auditoria (RF-ADM-5). O interceptor abre o contexto da requisição auditada;
// o caso de uso registra o antes/depois DENTRO da transação da mudança, então uma
// mudança desfeita (erro no meio) também desfaz o registro.
@Injectable()
export class AuditTrail {
  private readonly storage = new AsyncLocalStorage<AuditContext>();

  run<T>(context: Omit<AuditContext, 'recorded'>, fn: () => T): T {
    return this.storage.run({ ...context, recorded: 0 }, fn);
  }

  current(): AuditContext | undefined {
    return this.storage.getStore();
  }

  /** Fora de uma ação auditada (seed, jobs), não há quem registrar: não faz nada. */
  async record(db: AuditWriter, entry: AuditEntry): Promise<void> {
    const context = this.storage.getStore();
    if (!context) return;

    await db.auditLog.create({
      data: {
        actorUserId: context.actorUserId,
        action: context.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: toJson(entry.before),
        after: toJson(entry.after),
        ip: context.ip,
      },
    });
    context.recorded += 1;
  }
}

// Datas viram texto ISO e campos undefined somem, como numa resposta JSON.
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
