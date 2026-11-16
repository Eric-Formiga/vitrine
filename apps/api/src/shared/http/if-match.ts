import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainError, RequestValidationError } from '../errors/domain-error.js';

// Controle de concorrência otimista por versão (RFC 9110 §13.1.1, ASM-026). A resposta
// leva `ETag: "<versão>"`; a escrita devolve a versão que leu em `If-Match`. Se alguém
// gravou no meio, a versão não bate e a escrita é recusada em vez de sobrescrever.

/** A escrita veio sem If-Match: sem ele não dá para saber se a pessoa viu a última versão. */
export class PreconditionRequiredError extends DomainError {
  readonly code = 'PRECONDITION_REQUIRED';
  override readonly status = 428;

  constructor() {
    super('Envie o cabeçalho If-Match com o ETag da versão que você está editando.');
  }
}

export function etagOf(version: number): string {
  return `"${version}"`;
}

/** `"3"`, `W/"3"` ou `3` → 3. Ausente: 428. Fora do formato: 400. */
export function parseIfMatch(header: string | undefined): number {
  if (header === undefined || header.trim() === '') throw new PreconditionRequiredError();
  const match = /^(?:W\/)?"?(\d{1,9})"?$/.exec(header.trim());
  const version = match ? Number(match[1]) : 0;
  if (version < 1) {
    throw new RequestValidationError([{ field: 'If-Match', message: 'Use o ETag recebido, ex.: "3".' }]);
  }
  return version;
}

/** `@IfMatch() expectedVersion: number` — a versão que quem chama diz estar editando. */
export const IfMatch = createParamDecorator((_data: unknown, context: ExecutionContext): number =>
  parseIfMatch(context.switchToHttp().getRequest<Request>().header('if-match')),
);

/** Coloca o ETag da versão na resposta (use com `@Res({ passthrough: true })`). */
export function sendEtag(res: Response, version: number): void {
  res.setHeader('ETag', etagOf(version));
}
