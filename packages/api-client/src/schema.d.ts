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
    "/v1/seller/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Pedir uma URL de upload
         * @description JPEG, PNG ou WebP de até 5 MB. O arquivo vai para sellers/{sellerId}/ com um nome aleatório. Sem uso num produto em 24 h, ele é apagado. 503 STORAGE_NOT_CONFIGURED sem o Supabase.
         */
        post: operations["SellerUploadsController_create"];
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
    "/v1/seller/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Meus produtos
         * @description Do mais recente para o mais antigo.
         */
        get: operations["SellerProductsController_list"];
        put?: never;
        /**
         * Criar produto (rascunho)
         * @description O slug vem do título, único na loja. Responde com o ETag.
         */
        post: operations["SellerProductsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/seller/products/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Um produto meu
         * @description Responde com o ETag da versão atual.
         */
        get: operations["SellerProductsController_get"];
        put?: never;
        post?: never;
        /**
         * Arquivar
         * @description Sai de cena sem ser apagado (RN-17), com as variantes e as imagens. É final.
         */
        delete: operations["SellerProductsController_archive"];
        options?: never;
        head?: never;
        /**
         * Editar as informações
         * @description O slug não muda. 422 INVALID_STATE_TRANSITION se arquivado.
         */
        patch: operations["SellerProductsController_update"];
        trace?: never;
    };
    "/v1/seller/products/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publicar
         * @description Rascunho → ativo, com a data de publicação. Exige pelo menos uma foto e uma variante com estoque: senão 422 PRODUCT_NOT_PUBLISHABLE com `missing` (images, stock). Fora do rascunho: 422 INVALID_STATE_TRANSITION.
         */
        post: operations["SellerProductsController_publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/seller/products/{id}/variants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Grade de variantes
         * @description As ativas, com o ETag do produto.
         */
        get: operations["SellerVariantsController_list"];
        /**
         * Trocar a grade de variantes
         * @description A chave é tamanho + cor: quem continua mantém o id, quem sai é arquivada e quem volta é reativada. Recalcula o menor preço. 409 SKU_TAKEN se outra variante ativa da loja usa o SKU.
         */
        put: operations["SellerVariantsController_replace"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/seller/variants/{id}/stock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Ajustar o estoque
         * @description Pela diferença (delta) ou pelo valor final (absolute). Sem If-Match e sem mudar a versão do produto. 422 STOCK_WOULD_BE_NEGATIVE se ficaria abaixo de zero.
         */
        patch: operations["SellerVariantsController_adjust"];
        trace?: never;
    };
    "/v1/seller/products/{id}/images": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Fotos do produto
         * @description Na ordem (a primeira é a capa), com o ETag do produto.
         */
        get: operations["SellerProductImagesController_list"];
        /**
         * Trocar as fotos
         * @description De 0 a 8, já enviadas pela URL de upload. Cada arquivo é conferido no Storage (tipo e tamanho reais). 422 INVALID_IMAGE com `position` e `reason`. As que saíram vão para a limpeza.
         */
        put: operations["SellerProductImagesController_replace"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/products/{id}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suspender produto ativo
         * @description Exige o motivo, mostrado ao vendedor. O produto sai da vitrine; nada é apagado.
         */
        post: operations["AdminProductsController_suspend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/products/{id}/reinstate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reativar produto suspenso
         * @description Volta a ativo, com a data da primeira publicação.
         */
        post: operations["AdminProductsController_reinstate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/asaas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AsaasWebhookController_receive"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/seller/application": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Situação da minha loja
         * @description 404 se a pessoa ainda não se candidatou.
         */
        get: operations["SellerApplicationController_mine"];
        put?: never;
        /**
         * Candidatar-se a vender
         * @description Confere no Asaas se o titular da chave Pix é o CPF/CNPJ da loja. Sem a conferência, nada é gravado: 422 PIX_KEY_OWNER_MISMATCH ou PIX_KEY_NOT_FOUND; 503 PIX_KEY_CHECK_UNAVAILABLE se o Asaas não responder.
         */
        post: operations["SellerApplicationController_apply"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/seller/pix-key": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Chave Pix de recebimento
         * @description Com o titular conferido no Asaas.
         */
        get: operations["SellerAreaController_pixKey"];
        /**
         * Trocar a chave Pix
         * @description Confere o titular no Asaas, como na candidatura. Se falhar, a chave antiga continua: 422 PIX_KEY_OWNER_MISMATCH ou PIX_KEY_NOT_FOUND; 503 PIX_KEY_CHECK_UNAVAILABLE.
         */
        put: operations["SellerAreaController_replacePixKey"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/seller/shipping": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Configuração de frete
         * @description 404 SHIPPING_NOT_CONFIGURED se ainda não foi feita.
         */
        get: operations["SellerAreaController_shippingSettings"];
        /**
         * Configurar o frete
         * @description Substitui a configuração inteira.
         */
        put: operations["SellerAreaController_configureShipping"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sellers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Lojas por situação
         * @description Da candidatura mais antiga para a mais nova, com o CPF/CNPJ completo.
         */
        get: operations["AdminSellersController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sellers/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aprovar loja em análise
         * @description A dona ganha o papel seller na hora.
         */
        post: operations["AdminSellersController_approve"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sellers/{id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rejeitar loja em análise
         * @description Exige o motivo; a pessoa pode tentar de novo após 7 dias.
         */
        post: operations["AdminSellersController_reject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sellers/{id}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Suspender loja aprovada
         * @description Exige o motivo. Nada é apagado.
         */
        post: operations["AdminSellersController_suspend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sellers/{id}/reinstate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reativar loja suspensa */
        post: operations["AdminSellersController_reinstate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/admin/sellers/{id}/commission": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Comissão da loja
         * @description Pontos-base (800 = 8%), ou null para voltar à padrão de 12%.
         */
        patch: operations["AdminSellersController_commission"];
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
        /** @description Chave Pix de recebimento; o titular é conferido no Asaas. */
        PixKeyInput: {
            /** @enum {string} */
            type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
            key: string;
        };
        SellerApplicationInput: {
            storeName: string;
            /** @description Endereço da loja (/loja/{slug}). Gerado do nome quando omitido. */
            slug?: string;
            bio: string;
            /** @description CPF ou CNPJ da loja, com ou sem pontuação. */
            document: string;
            /** Format: uuid */
            mainCategoryId: string;
            instagram?: string | null;
            pixKey: components["schemas"]["PixKeyInput"];
        };
        VerifiedPixKey: {
            /** @enum {string} */
            type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
            key: string;
            /** @description Titular devolvido pelo Asaas. */
            ownerName: string;
            /** @description Documento do titular, mascarado pelo Asaas. */
            ownerDocument: string;
            /** Format: date-time */
            verifiedAt: string;
        };
        MySellerApplication: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
            storeName: string;
            slug: string;
            bio: string;
            instagram: string | null;
            /** Format: uuid */
            mainCategoryId: string;
            /** @description CPF/CNPJ mascarado. */
            document: string;
            pixKey: components["schemas"]["VerifiedPixKey"];
            /** Format: date-time */
            appliedAt: string;
            /** Format: date-time */
            approvedAt: string | null;
            /** @description Preenchido quando a loja foi rejeitada. */
            rejection: {
                reason: string;
                /** Format: date-time */
                rejectedAt: string;
                /** Format: date-time */
                canReapplyAt: string;
            } | null;
            suspension: {
                reason: string;
                /** Format: date-time */
                suspendedAt: string;
            } | null;
            /** @description O que já está pronto para a loja vender. */
            checklist: {
                store: boolean;
                pixKey: boolean;
                shipping: boolean;
            };
        };
        ShippingSettingsInput: {
            /** @description CEP de onde a loja posta, com ou sem hífen. */
            originZip: string;
            /** @description Centavos por região de destino (0 = grátis). */
            rates: {
                N: number;
                NE: number;
                CO: number;
                SE: number;
                S: number;
            };
            /** @description Frete grátis a partir deste valor do pedido (centavos). Omitido ou null: nunca grátis. */
            freeShippingThresholdCents: number | null;
            /** @description Dias úteis até a postagem (1 a 5). */
            handlingDays: number;
        };
        ShippingSettings: {
            /** @description 8 dígitos. */
            originZip: string;
            rates: {
                N: number;
                NE: number;
                CO: number;
                SE: number;
                S: number;
            };
            freeShippingThresholdCents: number | null;
            handlingDays: number;
        };
        SellerDecisionReason: {
            /** @description Motivo mostrado para a dona da loja. */
            reason: string;
        };
        SellerCommissionInput: {
            /** @description Pontos-base (800 = 8%). null volta à comissão padrão. */
            commissionBps: number | null;
        };
        AdminSeller: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
            storeName: string;
            slug: string;
            bio: string;
            instagram: string | null;
            /** Format: uuid */
            mainCategoryId: string;
            /** @description CPF/CNPJ completo, só dígitos (só o admin vê, ASM-017). */
            document: string;
            /** @description Conta dona da loja. */
            owner: {
                /** Format: uuid */
                id: string;
                name: string | null;
                email: string;
            };
            pixKey: components["schemas"]["VerifiedPixKey"];
            /** @description Comissão própria da loja; null usa a padrão. */
            commissionBps: number | null;
            /** @description A comissão que vale: a própria ou a padrão (1200 = 12%). */
            effectiveCommissionBps: number;
            /** Format: date-time */
            appliedAt: string;
            /** Format: date-time */
            approvedAt: string | null;
            rejection: {
                reason: string;
                /** Format: date-time */
                rejectedAt: string;
            } | null;
            suspension: {
                reason: string;
                /** Format: date-time */
                suspendedAt: string;
            } | null;
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
        ProductInput: {
            title: string;
            /** @description Texto puro; as quebras de linha são mantidas. Padrão: vazia. */
            description?: string;
            /**
             * Format: uuid
             * @description Categoria ativa e sem subcategorias.
             */
            categoryId: string;
            /** @enum {string} */
            condition: "NEW" | "USED";
        };
        /** @description Só os campos que mudam. Exige If-Match. */
        ProductChangesInput: {
            title?: string;
            /** @description Texto puro; as quebras de linha são mantidas. */
            description?: string;
            /**
             * Format: uuid
             * @description Categoria ativa e sem subcategorias.
             */
            categoryId?: string;
            /** @enum {string} */
            condition?: "NEW" | "USED";
        };
        SellerProduct: {
            /** Format: uuid */
            id: string;
            slug: string;
            title: string;
            description: string;
            /** Format: uuid */
            categoryId: string;
            /** @enum {string} */
            condition: "NEW" | "USED";
            /** @enum {string} */
            status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
            /** @description A mesma do cabeçalho ETag; mande de volta em If-Match. */
            version: number;
            /** @description Preço da variante ativa mais barata, em centavos. */
            minPriceCents: number | null;
            /** Format: date-time */
            publishedAt: string | null;
            /** @description Preenchido quando o admin suspendeu o produto. */
            suspension: {
                reason: string;
                /** Format: date-time */
                suspendedAt: string;
            } | null;
            /** Format: date-time */
            archivedAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        AdminProduct: {
            /** Format: uuid */
            id: string;
            slug: string;
            title: string;
            description: string;
            /** Format: uuid */
            categoryId: string;
            /** @enum {string} */
            condition: "NEW" | "USED";
            /** @enum {string} */
            status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
            /** @description A mesma do cabeçalho ETag; mande de volta em If-Match. */
            version: number;
            /** @description Preço da variante ativa mais barata, em centavos. */
            minPriceCents: number | null;
            /** Format: date-time */
            publishedAt: string | null;
            /** @description Preenchido quando o admin suspendeu o produto. */
            suspension: {
                reason: string;
                /** Format: date-time */
                suspendedAt: string;
            } | null;
            /** Format: date-time */
            archivedAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            /**
             * Format: uuid
             * @description Loja dona do produto.
             */
            sellerId: string;
        };
        SellerProductSummary: {
            /** Format: uuid */
            id: string;
            slug: string;
            title: string;
            /** @enum {string} */
            status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
            version: number;
            /** @description URL pública da capa (a imagem de posição 0). */
            coverUrl: string | null;
            minPriceCents: number | null;
            /** @description Soma do estoque das variantes ativas. */
            totalStock: number;
            /** @description Preenchido quando o admin suspendeu o produto. */
            suspension: {
                reason: string;
                /** Format: date-time */
                suspendedAt: string;
            } | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ProductImageInput: {
            /** @description O `path` devolvido por POST /v1/seller/uploads. */
            path: string;
            /**
             * @description Texto alternativo, para quem usa leitor de tela.
             * @default
             */
            alt: string;
            /**
             * @description Cor de uma variante ativa; nula vale para todas as cores.
             * @default null
             */
            color: string | null;
        };
        /** @description A lista inteira, na ordem: a primeira é a capa. Substitui a anterior. Exige If-Match. */
        ProductImagesInput: {
            images: components["schemas"]["ProductImageInput"][];
        };
        ProductImage: {
            path: string;
            /** @description URL pública; nula sem o Storage configurado. */
            url: string | null;
            alt: string;
            color: string | null;
            /** @description 0 é a capa. */
            position: number;
        };
        ProductImageList: {
            images: components["schemas"]["ProductImage"][];
        };
        VariantInput: {
            /** @description Único entre as variantes ativas da loja; guardado em maiúsculas. Sem ele: SLUG-TAMANHO-COR. */
            sku?: string;
            /** @description Da grade do tipo da categoria: PP, P, M, G, GG, XGG; 33 a 46; ou U. */
            size: string;
            /** @description Nome da cor, como o comprador vê. "Preto" e "preto" são a mesma. */
            color: string;
            colorHex: string;
            priceCents: number;
            /** @description Preço "de", riscado; maior que o preço. */
            compareAtCents?: number | null;
            stock: number;
            weightGrams: number;
        };
        /** @description A grade inteira: quem não vier é arquivada. Exige If-Match. */
        VariantGridInput: {
            variants: components["schemas"]["VariantInput"][];
        };
        StockAdjustmentInput: {
            /** @description Soma ao estoque atual (negativo tira). */
            delta?: number;
            /** @description Novo estoque, no lugar do atual. */
            absolute?: number;
        };
        SellerVariant: {
            /** Format: uuid */
            id: string;
            sku: string;
            size: string;
            color: string;
            colorHex: string;
            priceCents: number;
            compareAtCents: number | null;
            stock: number;
            /** @description Presas a checkouts em andamento; o estoque nunca fica abaixo disso. */
            reserved: number;
            weightGrams: number;
        };
        SellerVariantGrid: {
            /** @description As ativas, na ordem da grade de tamanhos. */
            variants: components["schemas"]["SellerVariant"][];
        };
        VariantStock: {
            /** Format: uuid */
            id: string;
            stock: number;
        };
        Me: {
            /** Format: uuid */
            id: string;
            email: string;
            name: string | null;
            /** @description Papéis guardados na Vitrine: customer, seller, admin. */
            roles: string[];
        };
        /** @description O tipo e o tamanho do arquivo que o navegador vai enviar. */
        UploadRequestInput: {
            /** @enum {string} */
            contentType: "image/jpeg" | "image/png" | "image/webp";
            sizeBytes: number;
        };
        UploadTicket: {
            /** @description Caminho no Storage; mande-o na lista de imagens do produto. */
            path: string;
            /**
             * Format: uri
             * @description Envie o arquivo com PUT e o cabeçalho Content-Type, sem login.
             */
            uploadUrl: string;
            /**
             * Format: date-time
             * @description Até quando a URL aceita o envio.
             */
            expiresAt: string;
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
    SellerUploadsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadRequestInput"];
            };
        };
        responses: {
            /** @description URL assinada */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadTicket"];
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
            /** @description Erro */
            403: {
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
            /** @description Erro */
            503: {
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
    SellerProductsController_list: {
        parameters: {
            query?: {
                status?: "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
            };
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
                    "application/json": components["schemas"]["SellerProductSummary"][];
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
            /** @description Erro */
            403: {
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
    SellerProductsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductInput"];
            };
        };
        responses: {
            /** @description Rascunho criado */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerProduct"];
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
            /** @description Erro */
            403: {
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
    SellerProductsController_get: {
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
                    "application/json": components["schemas"]["SellerProduct"];
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
            /** @description Erro */
            403: {
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
    SellerProductsController_archive: {
        parameters: {
            query?: never;
            header: {
                /** @description O ETag da versão que você está editando, ex.: "3". Desatualizado: 412; ausente: 428. */
                "If-Match": string;
            };
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
                    "application/json": components["schemas"]["SellerProduct"];
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
            /** @description Erro */
            403: {
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
            /** @description A versão em If-Match não é mais a atual: recarregue antes de gravar */
            412: {
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
            /** @description Falta o cabeçalho If-Match */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    SellerProductsController_update: {
        parameters: {
            query?: never;
            header: {
                /** @description O ETag da versão que você está editando, ex.: "3". Desatualizado: 412; ausente: 428. */
                "If-Match": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductChangesInput"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerProduct"];
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
            /** @description Erro */
            403: {
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
            /** @description A versão em If-Match não é mais a atual: recarregue antes de gravar */
            412: {
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
            /** @description Falta o cabeçalho If-Match */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    SellerProductsController_publish: {
        parameters: {
            query?: never;
            header: {
                /** @description O ETag da versão que você está editando, ex.: "3". Desatualizado: 412; ausente: 428. */
                "If-Match": string;
            };
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
                    "application/json": components["schemas"]["SellerProduct"];
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
            /** @description Erro */
            403: {
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
            /** @description A versão em If-Match não é mais a atual: recarregue antes de gravar */
            412: {
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
            /** @description Falta o cabeçalho If-Match */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    SellerVariantsController_list: {
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
                    "application/json": components["schemas"]["SellerVariantGrid"];
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
            /** @description Erro */
            403: {
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
    SellerVariantsController_replace: {
        parameters: {
            query?: never;
            header: {
                /** @description O ETag da versão do produto que você está editando, ex.: "3". Desatualizado: 412; ausente: 428. */
                "If-Match": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VariantGridInput"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerVariantGrid"];
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
            /** @description Erro */
            403: {
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
            /** @description A versão em If-Match não é mais a atual: recarregue antes de gravar */
            412: {
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
            /** @description Falta o cabeçalho If-Match */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    SellerVariantsController_adjust: {
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
                "application/json": components["schemas"]["StockAdjustmentInput"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VariantStock"];
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
            /** @description Erro */
            403: {
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
    SellerProductImagesController_list: {
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
                    "application/json": components["schemas"]["ProductImageList"];
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
            /** @description Erro */
            403: {
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
    SellerProductImagesController_replace: {
        parameters: {
            query?: never;
            header: {
                /** @description O ETag da versão do produto que você está editando, ex.: "3". Desatualizado: 412; ausente: 428. */
                "If-Match": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductImagesInput"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductImageList"];
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
            /** @description Erro */
            403: {
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
            /** @description A versão em If-Match não é mais a atual: recarregue antes de gravar */
            412: {
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
            /** @description Falta o cabeçalho If-Match */
            428: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
            /** @description Erro */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    AdminProductsController_suspend: {
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
                "application/json": components["schemas"]["SellerDecisionReason"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProduct"];
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
    AdminProductsController_reinstate: {
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
                    "application/json": components["schemas"]["AdminProduct"];
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
    AsaasWebhookController_receive: {
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
    SellerApplicationController_mine: {
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
                    "application/json": components["schemas"]["MySellerApplication"];
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
    SellerApplicationController_apply: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SellerApplicationInput"];
            };
        };
        responses: {
            /** @description Loja criada em análise */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MySellerApplication"];
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
            /** @description Erro */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    SellerAreaController_pixKey: {
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
                    "application/json": components["schemas"]["VerifiedPixKey"];
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
            /** @description Erro */
            403: {
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
    SellerAreaController_replacePixKey: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PixKeyInput"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerifiedPixKey"];
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
            /** @description Erro */
            403: {
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
            /** @description Erro */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
    SellerAreaController_shippingSettings: {
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
                    "application/json": components["schemas"]["ShippingSettings"];
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
            /** @description Erro */
            403: {
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
    SellerAreaController_configureShipping: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ShippingSettingsInput"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShippingSettings"];
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
            /** @description Erro */
            403: {
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
    AdminSellersController_list: {
        parameters: {
            query: {
                status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
            };
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
                    "application/json": components["schemas"]["AdminSeller"][];
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
        };
    };
    AdminSellersController_approve: {
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
                    "application/json": components["schemas"]["AdminSeller"];
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
    AdminSellersController_reject: {
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
                "application/json": components["schemas"]["SellerDecisionReason"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSeller"];
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
    AdminSellersController_suspend: {
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
                "application/json": components["schemas"]["SellerDecisionReason"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSeller"];
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
    AdminSellersController_reinstate: {
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
                    "application/json": components["schemas"]["AdminSeller"];
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
    AdminSellersController_commission: {
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
                "application/json": components["schemas"]["SellerCommissionInput"];
            };
        };
        responses: {
            /** @description Sucesso */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminSeller"];
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
        };
    };
}
