import { applyDecorators, type INestApplication } from '@nestjs/common';
import {
  ApiResponse,
  DocumentBuilder,
  type OpenAPIObject,
  type ReferenceObject,
  type SchemaObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { z } from 'zod';

// Contrato da API (ADR-0008, AC-031). O @nestjs/swagger monta as rotas; os formatos vêm
// dos schemas Zod marcados com .meta({ id }), convertidos com z.toJSONSchema (ASM-010).

const COMPONENTS = '#/components/schemas/';
export const SECURITY_SCHEME = 'clerk';

// ── Formato de erro (RFC 9457) ────────────────────────────────────────────────

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    requestId: z.string().optional(),
    code: z.string().optional().describe('Código do erro de domínio, ex.: SLUG_TAKEN.'),
    errors: z
      .array(z.object({ field: z.string(), message: z.string() }))
      .optional()
      .describe('Campos inválidos, quando code = VALIDATION_FAILED.'),
  })
  .meta({ id: 'ProblemDetails' });

const PROBLEM_DESCRIPTIONS: Record<number, string> = {
  400: 'Entrada inválida (VALIDATION_FAILED, com a lista de campos em errors)',
  401: 'É preciso entrar (token ausente, inválido ou vencido)',
  404: 'Não encontrado (inclusive para quem não tem o papel exigido)',
  409: 'Conflito com o que já existe',
  422: 'A regra de negócio não permite',
};

// ── Esquemas Zod → OpenAPI ────────────────────────────────────────────────────

/** Referência a um schema registrado (.meta({ id })) ou a uma lista deles. */
export function openApiSchema(schema: z.ZodType): SchemaObject | ReferenceObject {
  if (schema instanceof z.ZodArray) return { type: 'array', items: openApiSchema(schema.element as z.ZodType) };
  const id = z.globalRegistry.get(schema)?.id;
  if (!id) throw new Error('Schema sem .meta({ id }): registre-o para ele aparecer no contrato.');
  return { $ref: `${COMPONENTS}${id}` };
}

/** Todos os schemas registrados, no formato do OpenAPI 3.0. */
function zodComponents(): Record<string, SchemaObject> {
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    target: 'openapi-3.0',
    uri: (id) => `${COMPONENTS}${id}`,
  });
  // O $id é do JSON Schema; no OpenAPI quem identifica o schema é a chave em components.
  return Object.fromEntries(
    Object.entries(schemas).map(([id, schema]) => {
      const component: Record<string, unknown> = { ...schema };
      delete component.$id;
      return [id, component as SchemaObject];
    }),
  );
}

/** Resposta de sucesso com corpo descrito por um schema Zod registrado. */
export const ApiZodResponse = (status: number, schema: z.ZodType, description = 'Sucesso'): MethodDecorator =>
  ApiResponse({ status, description, content: { 'application/json': { schema: openApiSchema(schema) } } });

/** Respostas de erro possíveis, todas em application/problem+json (na rota ou no controller). */
export const ApiProblems = (...statuses: number[]): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: PROBLEM_DESCRIPTIONS[status] ?? 'Erro',
        content: { 'application/problem+json': { schema: openApiSchema(problemDetailsSchema) } },
      }),
    ),
  );

// ── Documento ─────────────────────────────────────────────────────────────────

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Vitrine API')
    .setDescription(
      'API do marketplace de moda Vitrine. Rotas privadas pedem o token de sessão do Clerk ' +
        '(Authorization: Bearer). Erros seguem a RFC 9457 (application/problem+json).',
    )
    .setVersion('1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token de sessão do Clerk' }, SECURITY_SCHEME)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.components = { ...document.components, schemas: { ...document.components?.schemas, ...zodComponents() } };
  return document;
}

/** Swagger UI em /docs e o JSON em /docs/openapi.json, públicos e fora do /v1 (ASM-009). */
export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: 'docs/openapi.json',
    customSiteTitle: 'Vitrine API',
    swaggerOptions: { persistAuthorization: true },
  });
}
