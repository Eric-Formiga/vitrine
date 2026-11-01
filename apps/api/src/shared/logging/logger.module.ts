import { randomUUID } from 'node:crypto';

import type { DynamicModule } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';

import type { Env } from '../config/env.js';

// Só aceita do cliente um id curto e sem caracteres que possam forjar linhas de log.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function loggerModule(env: Env, stream?: DestinationStream): DynamicModule {
  const options: Options = {
    level: env.LOG_LEVEL,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customProps: (req) => ({ requestId: req.id }),
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    // Nada de cabeçalhos no log: eles carregam token e cookie.
    serializers: {
      req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  };

  return PinoLoggerModule.forRoot({ pinoHttp: stream ? [options, stream] : options });
}
