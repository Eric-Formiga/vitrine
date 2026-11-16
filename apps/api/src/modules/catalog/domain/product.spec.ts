import { describe, expect, it } from 'vitest';

import { assertCanChange, slugCandidates } from './product.js';
import { InvalidProductStateError } from './product-errors.js';

const first = (title: string, n: number) => {
  const candidates = slugCandidates(title);
  return Array.from({ length: n }, () => candidates.next().value);
};

describe('produto', () => {
  it('sugere o slug do título e, se repetir, -2, -3...', () => {
    expect(first('Vestido Midi de Linho', 3)).toEqual(['vestido-midi-de-linho', 'vestido-midi-de-linho-2', 'vestido-midi-de-linho-3']);
  });

  it('título sem letra nem número vira "produto"; título longo é cortado sem hífen no fim', () => {
    expect(first('!!!', 1)).toEqual(['produto']);
    const [slug] = first(`${'a'.repeat(79)} b`, 1);
    expect(slug).toBe('a'.repeat(79));
  });

  it('o produto arquivado não muda mais', () => {
    for (const status of ['DRAFT', 'ACTIVE', 'SUSPENDED'] as const) {
      expect(() => assertCanChange({ status }, 'edit')).not.toThrow();
    }
    expect(() => assertCanChange({ status: 'ARCHIVED' }, 'archive')).toThrow(InvalidProductStateError);
  });
});
