import { describe, expect, it } from 'vitest';

import {
  assertCanChange,
  listedIssues,
  type ProductStatus,
  type ProductTransition,
  publishIssues,
  slugCandidates,
  transition,
} from './product.js';
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

  it('as mudanças de situação só partem da situação certa', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    expect(transition({ status: 'DRAFT' }, { kind: 'publish' }, now)).toEqual({ status: 'ACTIVE', publishedAt: now });
    expect(transition({ status: 'ACTIVE' }, { kind: 'suspend', reason: 'Foto de outra loja.' }, now)).toEqual({
      status: 'SUSPENDED',
      suspendedAt: now,
      suspensionReason: 'Foto de outra loja.',
    });
    expect(transition({ status: 'SUSPENDED' }, { kind: 'reinstate' }, now)).toEqual({
      status: 'ACTIVE',
      suspendedAt: null,
      suspensionReason: null,
    });
    for (const status of ['DRAFT', 'ACTIVE', 'SUSPENDED'] as const) {
      expect(transition({ status }, { kind: 'archive' }, now)).toEqual({ status: 'ARCHIVED', archivedAt: now });
    }

    const recusadas: [ProductStatus, ProductTransition][] = [
      ['ACTIVE', { kind: 'publish' }],
      ['SUSPENDED', { kind: 'publish' }],
      ['DRAFT', { kind: 'suspend', reason: 'x' }],
      ['ARCHIVED', { kind: 'suspend', reason: 'x' }],
      ['ACTIVE', { kind: 'reinstate' }],
      ['ARCHIVED', { kind: 'archive' }],
    ];
    for (const [status, change] of recusadas) {
      expect(() => transition({ status }, change, now), `${status} → ${change.kind}`).toThrow(InvalidProductStateError);
    }
  });

  it('publicar exige foto e uma variante com estoque', () => {
    expect(publishIssues({ imageCount: 1, activeStocks: [0, 3] })).toEqual([]);
    expect(publishIssues({ imageCount: 0, activeStocks: [0] })).toEqual(['images', 'stock']);
    expect(publishIssues({ imageCount: 2, activeStocks: [] })).toEqual(['stock']);
  });

  it('o produto publicado continua com foto e grade, mas pode ficar esgotado', () => {
    const vazio = { imageCount: 0, activeStocks: [] };
    expect(listedIssues({ status: 'ACTIVE' }, { imageCount: 1, activeStocks: [0, 0] })).toEqual([]);
    expect(listedIssues({ status: 'ACTIVE' }, vazio)).toEqual(['images', 'variants']);
    expect(listedIssues({ status: 'SUSPENDED' }, vazio)).toEqual(['images', 'variants']);
    expect(listedIssues({ status: 'DRAFT' }, vazio)).toEqual([]);
  });
});
