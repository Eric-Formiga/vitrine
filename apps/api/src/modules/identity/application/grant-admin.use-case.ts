import { Inject, Injectable } from '@nestjs/common';

import { DomainError } from '../../../shared/errors/domain-error.js';
import { USER_REPOSITORY, type UserRepository } from './user.repository.js';

export class AccountNotFoundError extends DomainError {
  readonly code = 'ACCOUNT_NOT_FOUND';
  override readonly status = 404;

  constructor(email: string) {
    super(`Nenhuma conta ativa da Vitrine tem o e-mail ${email}. A pessoa precisa entrar no site uma vez antes.`);
  }
}

export interface GrantAdminResult {
  userId: string;
  alreadyAdmin: boolean;
}

// Torna admin uma conta que já existe (spec 01: admin inicial via seed). AC-019, AC-020.
@Injectable()
export class GrantAdminUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(email: string): Promise<GrantAdminResult> {
    const user = await this.users.findActiveByEmail(email.trim());
    if (!user) throw new AccountNotFoundError(email.trim());

    if (user.roles.includes('admin')) return { userId: user.id, alreadyAdmin: true };

    await this.users.addRole(user.id, 'admin');
    return { userId: user.id, alreadyAdmin: false };
  }
}
