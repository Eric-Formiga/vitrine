import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuditLogInterceptor } from './audit-log.interceptor.js';
import { AuditTrail } from './audit-trail.js';

@Global()
@Module({
  providers: [AuditTrail, { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }],
  exports: [AuditTrail],
})
export class AuditModule {}
