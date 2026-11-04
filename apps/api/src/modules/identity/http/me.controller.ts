import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { ApiProblems, ApiZodResponse, SECURITY_SCHEME } from '../../../shared/openapi/openapi.js';
import { CurrentUser, type CurrentUserData } from './current-user.decorator.js';

export const meResponseSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string().nullable(),
    roles: z.array(z.string()).describe('Papéis guardados na Vitrine: customer, seller, admin.'),
  })
  .meta({ id: 'Me' });

type MeResponse = z.output<typeof meResponseSchema>;

// GET /v1/me — o perfil de quem está logado, com os papéis guardados na Vitrine.
@Controller('me')
@ApiTags('conta')
@ApiBearerAuth(SECURITY_SCHEME)
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Perfil de quem está logado' })
  @ApiZodResponse(200, meResponseSchema)
  @ApiProblems(401)
  me(@CurrentUser() user: CurrentUserData): MeResponse {
    return { id: user.id, email: user.email, name: user.name, roles: user.roles };
  }
}
