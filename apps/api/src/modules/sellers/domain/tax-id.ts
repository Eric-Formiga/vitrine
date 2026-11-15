// CPF e CNPJ: regras puras, sem banco nem provedor. Aceitam o número com ou sem pontuação.

/** Só os dígitos: "111.444.777-35" → "11144477735". */
export function taxIdDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string): boolean {
  const digits = taxIdDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = [...digits.slice(0, length)].reduce((acc, digit, i) => acc + Number(digit) * (length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function isValidCnpj(value: string): boolean {
  const digits = taxIdDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(digits[i]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** CPF (11 dígitos) ou CNPJ (14) com os dígitos verificadores certos. */
export function isValidTaxId(value: string): boolean {
  return isValidCpf(value) || isValidCnpj(value);
}

/**
 * Documento mascarado para mostrar ao próprio vendedor, no mesmo estilo do Asaas:
 * CPF "***.444.777-**", CNPJ "**.***.333/0001-**".
 */
export function maskTaxId(value: string): string {
  const d = taxIdDigits(value);
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.***.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return '***';
}
