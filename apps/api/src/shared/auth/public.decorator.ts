import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'vitrine:isPublic';

// Toda rota é privada por padrão; @Public() abre uma rota (health, webhooks, catálogo).
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
