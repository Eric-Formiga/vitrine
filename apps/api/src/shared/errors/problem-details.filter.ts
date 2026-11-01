import { STATUS_CODES } from 'node:http';

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainError } from './domain-error.js';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId?: string;
  code?: string;
}

// Todo erro da API sai no formato RFC 9457 (application/problem+json) — AC-013.
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ProblemDetails');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: unknown }>();
    const res = http.getResponse<Response>();

    const problem = this.toProblem(exception, req);
    if (problem.status >= 500) {
      // O detalhe vai só para o log do servidor; quem chamou recebe uma mensagem genérica.
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, req: Request & { id?: unknown }): ProblemDetails {
    const base = {
      instance: req.originalUrl,
      ...(typeof req.id === 'string' ? { requestId: req.id } : {}),
    };

    if (exception instanceof DomainError) {
      return {
        type: `/problems/${exception.code.toLowerCase().replace(/_/g, '-')}`,
        title: STATUS_CODES[exception.status] ?? 'Error',
        status: exception.status,
        detail: exception.message,
        code: exception.code,
        ...base,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        type: 'about:blank',
        title: STATUS_CODES[status] ?? 'Error',
        status,
        detail: detailOf(exception),
        ...base,
      };
    }

    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'Erro inesperado. Se continuar, informe o requestId ao suporte.',
      ...base,
    };
  }
}

function detailOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' ? message : exception.message;
}
