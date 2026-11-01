import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { User } from '../domain/user.js';

export type CurrentUserData = Omit<User, 'deletedAt'>;

// A pessoa logada, já carregada do banco pelo ClerkAuthGuard: @CurrentUser() user
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserData =>
    context.switchToHttp().getRequest<{ user: CurrentUserData }>().user,
);
