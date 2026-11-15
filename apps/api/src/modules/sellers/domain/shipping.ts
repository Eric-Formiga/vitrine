// Frete da loja (spec 02, AC-057): regras puras. O cálculo no carrinho fica para a Fase 2.

/** Regiões do Brasil: o valor do frete é por região de destino. */
export const REGIONS = ['N', 'NE', 'CO', 'SE', 'S'] as const;
export type Region = (typeof REGIONS)[number];

export const HANDLING_DAYS_MIN = 1;
export const HANDLING_DAYS_MAX = 5;

export interface ShippingSettings {
  /** CEP de origem, só os 8 dígitos. */
  originZip: string;
  /** Centavos por região. */
  rates: Record<Region, number>;
  /** Frete grátis a partir deste valor (centavos); null = nunca grátis. */
  freeShippingThresholdCents: number | null;
  /** Dias úteis entre o pagamento e a postagem. */
  handlingDays: number;
}

export interface ShippingIssue {
  field: string;
  message: string;
}

/** "01310-100" → "01310100". */
export function zipDigits(zip: string): string {
  return zip.replace(/\D/g, '');
}

const isCents = (value: number) => Number.isInteger(value) && value >= 0;

/** O que está errado na configuração (lista vazia = válida). Cada problema diz o campo. */
export function shippingIssues(settings: ShippingSettings): ShippingIssue[] {
  const issues: ShippingIssue[] = [];

  if (!/^\d{8}$/.test(settings.originZip)) {
    issues.push({ field: 'originZip', message: 'Informe o CEP de origem com 8 dígitos.' });
  }
  for (const region of REGIONS) {
    const value = settings.rates[region];
    if (value === undefined) issues.push({ field: `rates.${region}`, message: `Informe o frete para a região ${region}.` });
    else if (!isCents(value)) {
      issues.push({ field: `rates.${region}`, message: 'Use um valor em centavos, inteiro e sem sinal (0 = grátis).' });
    }
  }
  const threshold = settings.freeShippingThresholdCents;
  if (threshold !== null && !(Number.isInteger(threshold) && threshold > 0)) {
    issues.push({ field: 'freeShippingThresholdCents', message: 'Use um valor em centavos maior que zero, ou deixe vazio.' });
  }
  const days = settings.handlingDays;
  if (!Number.isInteger(days) || days < HANDLING_DAYS_MIN || days > HANDLING_DAYS_MAX) {
    issues.push({
      field: 'handlingDays',
      message: `O prazo de postagem vai de ${HANDLING_DAYS_MIN} a ${HANDLING_DAYS_MAX} dias úteis.`,
    });
  }
  return issues;
}
