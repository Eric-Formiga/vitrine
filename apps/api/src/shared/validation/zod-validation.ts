import { Body, type PipeTransform } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

import { RequestValidationError } from '../errors/domain-error.js';
import { openApiSchema } from '../openapi/openapi.js';

// Mensagens padrão do Zod em português do Brasil (cada schema ainda pode ter as suas).
z.config(z.locales.ptBR());

// Valida a entrada com um schema Zod 4 e devolve o valor já convertido.
// O nestjs-zod não suporta o Nest 12 (ASM-010), então esta é a cola própria.
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new RequestValidationError(
      result.error.issues.map((issue) => ({ field: issue.path.map(String).join('.'), message: issue.message })),
    );
  }
}

/**
 * Corpo da requisição validado: `@ZodBody(createCategorySchema) body: CreateCategoryInput`.
 * Também documenta o corpo no contrato OpenAPI (o schema precisa ter .meta({ id })).
 */
export const ZodBody =
  (schema: z.ZodType): ParameterDecorator =>
  (target, propertyKey, index) => {
    Body(new ZodValidationPipe(schema))(target, propertyKey, index);
    if (propertyKey === undefined) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);
    if (descriptor) ApiBody({ schema: openApiSchema(schema) })(target, propertyKey, descriptor);
  };
