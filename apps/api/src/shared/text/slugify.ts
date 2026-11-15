// "Calçados Femininos" → "calcados-femininos": minúsculo, sem acento, só letras,
// números e hífens. Devolve "" quando não sobra nada aproveitável.
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
