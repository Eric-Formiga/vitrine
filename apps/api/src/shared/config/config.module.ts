import { type DynamicModule, Module } from '@nestjs/common';

import type { Env } from './env.js';

// Token para injetar a configuração já validada: @Inject(ENV) env: Env
export const ENV = Symbol('ENV');

@Module({})
export class ConfigModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: ConfigModule,
      global: true,
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV],
    };
  }
}
