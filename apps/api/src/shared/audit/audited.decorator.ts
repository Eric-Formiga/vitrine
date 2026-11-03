import { SetMetadata } from '@nestjs/common';

export const AUDITED_ACTION = 'vitrine:auditedAction';

// Marca uma escrita do admin como auditada: @Audited('category.update').
// O caso de uso grava o antes/depois com AuditTrail.record(), na mesma transação da mudança.
export const Audited = (action: string): MethodDecorator => SetMetadata(AUDITED_ACTION, action);
