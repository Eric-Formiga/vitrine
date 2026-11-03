import { type CallHandler, type ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import { AUDITED_ACTION } from './audited.decorator.js';
import { AuditTrail } from './audit-trail.js';

// Toda escrita marcada com @Audited roda dentro de um contexto de auditoria com o
// autor (do banco, via guard de login), o IP e a ação. Leituras e rotas sem a marca
// passam direto. Erros desfazem a transação do caso de uso, e o registro vai junto.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(
    private readonly reflector: Reflector,
    private readonly trail: AuditTrail,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(AUDITED_ACTION, context.getHandler());
    if (!action) return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    if (!req.user) throw new Error(`Ação auditada "${action}" sem pessoa logada: a rota não pode ser pública.`);
    const audit = { actorUserId: req.user.id, ip: req.ip ?? null, action };

    // O handler só roda quando alguém assina o Observable: o contexto precisa envolver a assinatura.
    return new Observable((subscriber) =>
      this.trail.run(audit, () =>
        next
          .handle()
          .pipe(
            tap({
              complete: () => {
                if (this.trail.current()?.recorded === 0) {
                  this.logger.warn(`A ação auditada "${action}" terminou sem registrar nada na trilha.`);
                }
              },
            }),
          )
          .subscribe(subscriber),
      ),
    );
  }
}
