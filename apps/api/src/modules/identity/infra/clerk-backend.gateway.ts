import { type ClerkClient, createClerkClient } from '@clerk/backend';
import { Inject, Injectable } from '@nestjs/common';

import { ENV } from '../../../shared/config/config.module.js';
import type { Env } from '../../../shared/config/env.js';
import type { ClerkGateway } from '../application/clerk-gateway.port.js';
import type { ClerkProfile } from '../domain/user.js';

@Injectable()
export class ClerkBackendGateway implements ClerkGateway {
  private readonly client: ClerkClient;

  constructor(@Inject(ENV) env: Env) {
    this.client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  }

  async fetchProfile(clerkId: string): Promise<ClerkProfile | null> {
    try {
      const user = await this.client.users.getUser(clerkId);
      const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      if (!email) return null;
      return {
        clerkId: user.id,
        email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        phone: user.primaryPhoneNumber?.phoneNumber ?? null,
      };
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  }
}
