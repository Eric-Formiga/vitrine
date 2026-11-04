// Gerado por `pnpm api:generate` a partir de packages/api-client/openapi.json.
// Não edite à mão: mude a API e gere de novo.

export interface paths {
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_live"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["HealthController_ready"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/clerk": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ClerkWebhookController_receive"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Perfil de quem está logado */
        get: operations["MeController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Árvore de categorias ativas
         * @description Ordenada por posição e, empatadas, por nome.
         */
        get: operations["CategoriesController_tree"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Árvore completa, com as arquivadas */
        get: operations["AdminCategoriesController_list"];
        put?: never;
        /**
         * Criar categoria
         * @description Sem slug, ele é gerado do nome.
         */
        post: operations["AdminCategoriesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Arquivar categoria (e as descendentes)
         * @description Nada é apagado; o slug continua reservado.
         */
        delete: operations["AdminCategoriesController_archive"];
        options?: never;
        head?: never;
        /** Editar ou mover categoria */
        patch: operations["AdminCategoriesController_update"];
        trace?: never;
    };
    "/v1/admin/categories/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Restaurar categoria
         * @description Só ela volta; exige a pai ativa.
         */
        post: operations["AdminCategoriesController_restore"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ProblemDetails: {
            type: string;
            title: string;
            status: number;
            detail: string;
            instance: string;
            requestId?: string;
            /** @description Código do erro de domínio, ex.: SLUG_TAKEN. */
            code?: string;
            /** @description Campos inválidos, quando code = VALIDATION_FAILED. */
            errors?: {
                field: string;
                message: string;
            }[];
        };
        /** @description Guia de medidas: cada linha tem o mesmo número de colunas. */
        SizeChart: {
            columns: string[];
            rows: string[][];
        };
        CreateCategory: {
            name: string;
            /**
             * @description Grade de tamanhos: CLOTHING (PP–XGG), SHOES (33–46) ou ONE_SIZE (U).
             * @enum {string}
             */
            sizeType: "CLOTHING" | "SHOES" | "ONE_SIZE";
            /** @description Gerado do nome quando omitido. */
            slug?: string;
            /**
             * Format: uuid
             * @description Categoria pai; omitido ou null = primeiro nível.
             */
            parentId?: string | null;
            /** @description Ordem entre as irmãs (padrão 0). */
            position?: number;
            sizeChart?: components["schemas"]["SizeChart"] | null;
        };
        /** @description Só os campos enviados mudam. */
        UpdateCategory: {
            name?: string;
            /**
             * @description Grade de tamanhos: CLOTHING (PP–XGG), SHOES (33–46) ou ONE_SIZE (U).
             * @enum {string}
             */
            sizeType?: "CLOTHING" | "SHOES" | "ONE_SIZE";
            slug?: string;
            /** Format: uuid */
            parentId?: string | null;
            position?: number;
            sizeChart?: components["schemas"]["SizeChart"] | null;
        };
        PublicCategoryNode: {
            /** Format: uuid */
            id: string;
            name: string;
            slug: string;
            /**
             * @description Grade de tamanhos: CLOTHING (PP–XGG), SHOES (33–46) ou ONE_SIZE (U).
             * @enum {string}
             */
            sizeType: "CLOTHING" | "SHOES" | "ONE_SIZE";
            sizeChart: components["schemas"]["SizeChart"] | null;
            children: components["schemas"]["PublicCategoryNode"][];
        };
        AdminCategory: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            parentId: string | null;
            name: string;
            slug: string;
            position: number;
            /**
             * @description Grade de tamanhos: CLOTHING (PP–XGG), SHOES (33–46) ou ONE_SIZE (U).
             * @enum {string}
             */
            sizeType: "CLOTHING" | "SHOES" | "ONE_SIZE";
            sizeChart: components["schemas"]["SizeChart"] | null;
            /**
             * Format: date-time
             * @description Preenchido quando a categoria está arquivada.
             */
            archivedAt: string | null;
        };
        AdminCategoryNode: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            parentId: string | null;
            name: string;
            slug: string;
            position: number;
            /**
             * @description Grade de tamanhos: CLOTHING (PP–XGG), SHOES (33–46) ou ONE_SIZE (U).
             * @enum {string}
             */
            sizeType: "CLOTHING" | "SHOES" | "ONE_SIZE";
            sizeChart: components["schemas"]["SizeChart"] | null;
            /**
             * Format: date-time
             * @description Preenchido quando a categoria está arquivada.
             */
            archivedAt: string | null;
            children: components["schemas"]["AdminCategoryNode"][];
        };
        Me: {
            /** Format: uuid */
            id: string;
            email: string;
            name: string | null;
            /** @description Papéis guardados na Vitrine: customer, seller, admin. */
            roles: string[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_live: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HealthController_ready: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ClerkWebhookController_receive: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MeController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Me"];
                };
            };
            /** @description É preciso entrar (token ausente, inválido ou vencido) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    CategoriesController_tree: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicCategoryNode"][];
                };
            };
        };
    };
    AdminCategoriesController_list: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCategoryNode"][];
                };
            };
            /** @description É preciso entrar (token ausente, inválido ou vencido) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Não encontrado (inclusive para quem não tem o papel exigido) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    AdminCategoriesController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCategory"];
            };
        };
        responses: {
            /** @description Criada */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCategory"];
                };
            };
            /** @description Entrada inválida (VALIDATION_FAILED, com a lista de campos em errors) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description É preciso entrar (token ausente, inválido ou vencido) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Não encontrado (inclusive para quem não tem o papel exigido) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Conflito com o que já existe */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description A regra de negócio não permite */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    AdminCategoriesController_archive: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Arquivada */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description É preciso entrar (token ausente, inválido ou vencido) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Não encontrado (inclusive para quem não tem o papel exigido) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    AdminCategoriesController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCategory"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCategory"];
                };
            };
            /** @description Entrada inválida (VALIDATION_FAILED, com a lista de campos em errors) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description É preciso entrar (token ausente, inválido ou vencido) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Não encontrado (inclusive para quem não tem o papel exigido) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Conflito com o que já existe */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description A regra de negócio não permite */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    AdminCategoriesController_restore: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminCategory"];
                };
            };
            /** @description É preciso entrar (token ausente, inválido ou vencido) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Não encontrado (inclusive para quem não tem o papel exigido) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description A regra de negócio não permite */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
}
