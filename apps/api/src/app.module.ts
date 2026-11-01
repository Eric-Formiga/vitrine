import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { DestinationStream } from 'pino';

import type { ClerkGateway } from './modules/identity/application/clerk-gateway.port.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { ConfigModule } from './shared/config/config.module.js';
import type { Env } from './shared/config/env.js';
import { ProblemDetailsFilter } from './shared/errors/problem-details.filter.js';
import { HealthModule } from './shared/health/health.module.js';
import { loggerModule } from './shared/logging/logger.module.js';
import { PrismaModule } from './shared/prisma/prisma.module.js';
import { QueueModule } from './shared/queue/queue.module.js';

export interface AppModuleOptions {
  env: Env;
  logStream?: DestinationStream;
  imports?: ModuleMetadata['imports'];
  clerkGateway?: ClerkGateway;
}

@Module({})
export class AppModule {
  static forRoot({ env, logStream, imports = [], clerkGateway }: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        loggerModule(env, logStream),
        PrismaModule,
        QueueModule,
        HealthModule,
        IdentityModule.forRoot({ clerkGateway }),
        ...imports,
      ],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}
