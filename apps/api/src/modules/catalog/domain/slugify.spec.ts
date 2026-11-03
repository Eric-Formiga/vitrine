import { describe, expect, it } from 'vitest';

import { slugify } from './slugify.js';

describe('slugify', () => {
  it('tira acentos, põe em minúsculas e troca espaços por hífens', () => {
    expect(slugify('Calçados Femininos')).toBe('calcados-femininos');
    expect(slugify('Ação & Reação')).toBe('acao-reacao');
  });

  it('não deixa hífens repetidos nem nas pontas', () => {
    expect(slugify('  --Bolsas   de  Couro!-- ')).toBe('bolsas-de-couro');
  });

  it('mantém números', () => {
    expect(slugify('Tênis 2026')).toBe('tenis-2026');
  });

  it('devolve vazio quando não sobra letra nem número', () => {
    expect(slugify('***')).toBe('');
  });
});
