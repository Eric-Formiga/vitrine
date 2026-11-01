import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // "Viva": responde enquanto o processo estiver de pé, sem depender do banco.
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
