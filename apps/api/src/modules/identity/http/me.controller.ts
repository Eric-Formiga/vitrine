import { Controller, Get } from '@nestjs/common';

import { CurrentUser, type CurrentUserData } from './current-user.decorator.js';

interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

// GET /v1/me — o perfil de quem está logado, com os papéis guardados na Vitrine.
@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: CurrentUserData): MeResponse {
    return { id: user.id, email: user.email, name: user.name, roles: user.roles };
  }
}
