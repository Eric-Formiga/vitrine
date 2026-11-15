import { z } from 'zod';

import { SLUG_PATTERN } from '../../../shared/text/slugify.js';
import { PIX_KEY_TYPES } from '../../payments/domain/pix-key.js';
import type { SellerWithOwner } from '../application/seller.repository.js';
import {
  canReapplyAt,
  effectiveCommissionBps,
  MAX_COMMISSION_BPS,
  SELLER_STATUSES,
  type Seller,
  type SellerChecklist,
  type VerifiedPixKey,
} from '../domain/seller.js';
import { HANDLING_DAYS_MAX, HANDLING_DAYS_MIN, type Region, REGIONS, shippingIssues, zipDigits } from '../domain/shipping.js';
import { isValidTaxId, maskTaxId } from '../domain/tax-id.js';

// Formatos de entrada e saída das rotas de lojas. Cada schema com .meta({ id }) vira
// um componente do contrato OpenAPI e um tipo do @vitrine/api-client (ADR-0008).

export const pixKeySchema = z
  .object({
    type: z.enum(PIX_KEY_TYPES, { error: 'Use CPF, CNPJ, EMAIL, PHONE ou EVP.' }),
    key: z.string({ error: 'Informe a chave Pix.' }).trim().min(1, 'Informe a chave Pix.').max(77),
  })
  .strict()
  .meta({ id: 'PixKeyInput', description: 'Chave Pix de recebimento; o titular é conferido no Asaas.' });

export type PixKeyBody = z.output<typeof pixKeySchema>;

// ── Entrada ───────────────────────────────────────────────────────────────────

export const sellerApplicationSchema = z
  .object({
    storeName: z.string({ error: 'Informe o nome da loja.' }).trim().min(2, 'Use pelo menos 2 caracteres.').max(60),
    slug: z
      .string()
      .max(60)
      .regex(SLUG_PATTERN, 'Use só letras minúsculas sem acento, números e hífens (ex.: ateliê-ana → atelie-ana).')
      .optional()
      .describe('Endereço da loja (/loja/{slug}). Gerado do nome quando omitido.'),
    bio: z.string({ error: 'Conte um pouco sobre a loja.' }).trim().min(10, 'Use pelo menos 10 caracteres.').max(500),
    document: z
      .string({ error: 'Informe o CPF ou CNPJ.' })
      .refine(isValidTaxId, 'CPF ou CNPJ inválido. Confira os números.')
      .describe('CPF ou CNPJ da loja, com ou sem pontuação.'),
    mainCategoryId: z.uuid('Escolha uma categoria.'),
    instagram: z
      .string()
      .trim()
      .transform((handle) => handle.replace(/^@/, ''))
      .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/, 'Use o @ do Instagram (letras, números, ponto e sublinhado).'))
      .nullish(),
    pixKey: pixKeySchema,
  })
  .strict()
  .meta({ id: 'SellerApplicationInput' });

export type SellerApplicationBody = z.output<typeof sellerApplicationSchema>;

// ── Saída ─────────────────────────────────────────────────────────────────────

export const verifiedPixKeySchema = z
  .object({
    type: z.enum(PIX_KEY_TYPES),
    key: z.string(),
    ownerName: z.string().describe('Titular devolvido pelo Asaas.'),
    ownerDocument: z.string().describe('Documento do titular, mascarado pelo Asaas.'),
    verifiedAt: z.iso.datetime(),
  })
  .meta({ id: 'VerifiedPixKey' });

export const myApplicationSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(SELLER_STATUSES),
    storeName: z.string(),
    slug: z.string(),
    bio: z.string(),
    instagram: z.string().nullable(),
    mainCategoryId: z.uuid(),
    document: z.string().describe('CPF/CNPJ mascarado.'),
    pixKey: verifiedPixKeySchema,
    appliedAt: z.iso.datetime(),
    approvedAt: z.iso.datetime().nullable(),
    rejection: z
      .object({ reason: z.string(), rejectedAt: z.iso.datetime(), canReapplyAt: z.iso.datetime() })
      .nullable()
      .describe('Preenchido quando a loja foi rejeitada.'),
    suspension: z.object({ reason: z.string(), suspendedAt: z.iso.datetime() }).nullable(),
    checklist: z
      .object({ store: z.boolean(), pixKey: z.boolean(), shipping: z.boolean() })
      .describe('O que já está pronto para a loja vender.'),
  })
  .meta({ id: 'MySellerApplication' });

export type MyApplicationResponse = z.output<typeof myApplicationSchema>;

// ── Área do vendedor (US-021) ─────────────────────────────────────────────────

export type VerifiedPixKeyResponse = z.output<typeof verifiedPixKeySchema>;

export function toVerifiedPixKey(pixKey: VerifiedPixKey): VerifiedPixKeyResponse {
  return { ...pixKey, verifiedAt: pixKey.verifiedAt.toISOString() };
}

const regionRates = <T extends z.ZodType>(rate: (region: Region) => T) =>
  z.object(Object.fromEntries(REGIONS.map((region) => [region, rate(region)])) as Record<Region, T>);

// O Zod confere o formato (tipos e campos obrigatórios); as faixas (CEP com 8 dígitos,
// valores sem sinal, prazo de 1 a 5) são a regra do domínio, aplicada aqui no superRefine.
export const shippingSettingsInputSchema = z
  .object({
    originZip: z
      .string({ error: 'Informe o CEP de origem.' })
      .transform(zipDigits)
      .pipe(z.string())
      .describe('CEP de onde a loja posta, com ou sem hífen.'),
    rates: regionRates((region) => z.int({ error: `Informe o frete para a região ${region}, em centavos.` }))
      .strict()
      .describe('Centavos por região de destino (0 = grátis).'),
    freeShippingThresholdCents: z
      .int({ error: 'Use um valor em centavos, ou null.' })
      .nullish()
      .transform((value) => value ?? null)
      .pipe(z.int().nullable())
      .describe('Frete grátis a partir deste valor do pedido (centavos). Omitido ou null: nunca grátis.'),
    handlingDays: z
      .int({ error: 'Informe o prazo de postagem, em dias úteis.' })
      .describe(`Dias úteis até a postagem (${HANDLING_DAYS_MIN} a ${HANDLING_DAYS_MAX}).`),
  })
  .strict()
  .superRefine((settings, ctx) => {
    for (const issue of shippingIssues(settings)) {
      ctx.addIssue({ code: 'custom', path: issue.field.split('.'), message: issue.message });
    }
  })
  .meta({ id: 'ShippingSettingsInput' });

export type ShippingSettingsBody = z.output<typeof shippingSettingsInputSchema>;

export const shippingSettingsSchema = z
  .object({
    originZip: z.string().describe('8 dígitos.'),
    rates: regionRates(() => z.int()),
    freeShippingThresholdCents: z.int().nullable(),
    handlingDays: z.int(),
  })
  .meta({ id: 'ShippingSettings' });

// ── Admin (US-018 a US-020) ───────────────────────────────────────────────────

export const sellerStatusQuerySchema = z.enum(SELLER_STATUSES, {
  error: 'Informe a situação: PENDING, APPROVED, REJECTED ou SUSPENDED.',
});

export const decisionReasonSchema = z
  .object({
    reason: z
      .string({ error: 'Informe o motivo.' })
      .trim()
      .min(3, 'Explique o motivo em pelo menos 3 caracteres.')
      .max(500)
      .describe('Motivo mostrado para a dona da loja.'),
  })
  .strict()
  .meta({ id: 'SellerDecisionReason' });

export type DecisionReasonBody = z.output<typeof decisionReasonSchema>;

export const commissionSchema = z
  .object({
    commissionBps: z
      .int({ error: 'Use um número inteiro de pontos-base (ex.: 800 = 8%), ou null.' })
      .min(0, 'A comissão vai de 0 a 10000 pontos-base.')
      .max(MAX_COMMISSION_BPS, 'A comissão vai de 0 a 10000 pontos-base.')
      .nullable()
      .describe('Pontos-base (800 = 8%). null volta à comissão padrão.'),
  })
  .strict()
  .meta({ id: 'SellerCommissionInput' });

export type CommissionBody = z.output<typeof commissionSchema>;

export const adminSellerSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(SELLER_STATUSES),
    storeName: z.string(),
    slug: z.string(),
    bio: z.string(),
    instagram: z.string().nullable(),
    mainCategoryId: z.uuid(),
    document: z.string().describe('CPF/CNPJ completo, só dígitos (só o admin vê, ASM-017).'),
    owner: z.object({ id: z.uuid(), name: z.string().nullable(), email: z.string() }).describe('Conta dona da loja.'),
    pixKey: verifiedPixKeySchema,
    commissionBps: z.int().nullable().describe('Comissão própria da loja; null usa a padrão.'),
    effectiveCommissionBps: z.int().describe('A comissão que vale: a própria ou a padrão (1200 = 12%).'),
    appliedAt: z.iso.datetime(),
    approvedAt: z.iso.datetime().nullable(),
    rejection: z.object({ reason: z.string(), rejectedAt: z.iso.datetime() }).nullable(),
    suspension: z.object({ reason: z.string(), suspendedAt: z.iso.datetime() }).nullable(),
  })
  .meta({ id: 'AdminSeller' });

export type AdminSellerResponse = z.output<typeof adminSellerSchema>;

export function toAdminSeller(seller: SellerWithOwner): AdminSellerResponse {
  return {
    id: seller.id,
    status: seller.status,
    storeName: seller.storeName,
    slug: seller.slug,
    bio: seller.bio,
    instagram: seller.instagram,
    mainCategoryId: seller.mainCategoryId,
    document: seller.document,
    owner: seller.owner,
    pixKey: { ...seller.pixKey, verifiedAt: seller.pixKey.verifiedAt.toISOString() },
    commissionBps: seller.commissionBps,
    effectiveCommissionBps: effectiveCommissionBps(seller),
    appliedAt: seller.appliedAt.toISOString(),
    approvedAt: iso(seller.approvedAt),
    rejection:
      seller.status === 'REJECTED' && seller.rejectedAt
        ? { reason: seller.rejectionReason ?? '', rejectedAt: seller.rejectedAt.toISOString() }
        : null,
    suspension:
      seller.status === 'SUSPENDED' && seller.suspendedAt
        ? { reason: seller.suspensionReason ?? '', suspendedAt: seller.suspendedAt.toISOString() }
        : null,
  };
}

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

export function toMyApplication(seller: Seller, checklist: SellerChecklist): MyApplicationResponse {
  return {
    id: seller.id,
    status: seller.status,
    storeName: seller.storeName,
    slug: seller.slug,
    bio: seller.bio,
    instagram: seller.instagram,
    mainCategoryId: seller.mainCategoryId,
    document: maskTaxId(seller.document),
    pixKey: { ...seller.pixKey, verifiedAt: seller.pixKey.verifiedAt.toISOString() },
    appliedAt: seller.appliedAt.toISOString(),
    approvedAt: iso(seller.approvedAt),
    rejection:
      seller.status === 'REJECTED' && seller.rejectedAt
        ? {
            reason: seller.rejectionReason ?? '',
            rejectedAt: seller.rejectedAt.toISOString(),
            canReapplyAt: canReapplyAt(seller.rejectedAt).toISOString(),
          }
        : null,
    suspension:
      seller.status === 'SUSPENDED' && seller.suspendedAt
        ? { reason: seller.suspensionReason ?? '', suspendedAt: seller.suspendedAt.toISOString() }
        : null,
    checklist,
  };
}
