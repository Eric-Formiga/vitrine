import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { DestinationStream } from 'pino';

import { ConfigModule } from './shared/config/config.module.js';
import type { Env } from './shared/config/env.js';
import { ProblemDetailsFilter } from './shared/errors/problem-details.filter.js';
import { HealthModule } from './shared/health/health.module.js';
import { loggerModule } from './shared/logging/logger.module.js';

export interface AppModuleOptions {
  env: Env;
  logStream?: DestinationStream;
  imports?: ModuleMetadata['imports'];
}

@Module({})
export class AppModule {
  static forRoot({ env, logStream, imports = [] }: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(env), loggerModule(env, logStream), HealthModule, ...imports],
      providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
    };
  }
}
