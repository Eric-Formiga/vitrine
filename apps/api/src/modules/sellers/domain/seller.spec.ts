import { describe, expect, it } from 'vitest';

import {
  auditViewOf,
  decide,
  DEFAULT_COMMISSION_BPS,
  effectiveCommissionBps,
  SELLER_STATUSES,
  type Seller,
  type SellerDecision,
  type SellerStatus,
} from './seller.js';
import { InvalidStateTransitionError } from './seller-errors.js';

const NOW = new Date('2026-11-15T12:00:00Z');

const DECISIONS: Record<SellerDecision['kind'], SellerDecision> = {
  approve: { kind: 'approve' },
  reject: { kind: 'reject', reason: 'Fotos não conferem.' },
  suspend: { kind: 'suspend', reason: 'Reclamações de entrega.' },
  reinstate: { kind: 'reinstate' },
};

/** A única situação de onde cada decisão pode partir. */
const ALLOWED_FROM: Record<SellerDecision['kind'], SellerStatus> = {
  approve: 'PENDING',
  reject: 'PENDING',
  suspend: 'APPROVED',
  reinstate: 'SUSPENDED',
};

describe('decisões do admin sobre a loja', () => {
  it('aprovar leva a loja em análise para APPROVED, com a data', () => {
    expect(decide({ status: 'PENDING' }, DECISIONS.approve, NOW)).toEqual({ status: 'APPROVED', approvedAt: NOW });
  });

  it('rejeitar leva a loja em análise para REJECTED, com o motivo e a data', () => {
    expect(decide({ status: 'PENDING' }, DECISIONS.reject, NOW)).toEqual({
      status: 'REJECTED',
      rejectedAt: NOW,
      rejectionReason: 'Fotos não conferem.',
    });
  });

  it('suspender leva a loja aprovada para SUSPENDED, com o motivo e a data', () => {
    expect(decide({ status: 'APPROVED' }, DECISIONS.suspend, NOW)).toEqual({
      status: 'SUSPENDED',
      suspendedAt: NOW,
      suspensionReason: 'Reclamações de entrega.',
    });
  });

  it('reativar devolve a loja suspensa para APPROVED e limpa a suspensão', () => {
    expect(decide({ status: 'SUSPENDED' }, DECISIONS.reinstate, NOW)).toEqual({
      status: 'APPROVED',
      suspendedAt: null,
      suspensionReason: null,
    });
  });

  for (const [kind, decision] of Object.entries(DECISIONS)) {
    const blocked = SELLER_STATUSES.filter((status) => status !== ALLOWED_FROM[decision.kind]);
    it(`"${kind}" é recusado a partir de ${blocked.join(', ')}`, () => {
      for (const status of blocked) {
        expect(() => decide({ status }, decision, NOW), status).toThrow(InvalidStateTransitionError);
      }
    });
  }
});

describe('comissão da loja', () => {
  it('sem comissão própria, vale a padrão de 12%', () => {
    expect(DEFAULT_COMMISSION_BPS).toBe(1200);
    expect(effectiveCommissionBps({ commissionBps: null })).toBe(1200);
  });

  it('com comissão própria (até 0%), vale a própria', () => {
    expect(effectiveCommissionBps({ commissionBps: 800 })).toBe(800);
    expect(effectiveCommissionBps({ commissionBps: 0 })).toBe(0);
  });
});

describe('o que vai para a auditoria', () => {
  it('nunca leva o CPF/CNPJ nem a chave Pix', () => {
    const seller: Seller = {
      id: 'loja-1',
      userId: 'user-1',
      storeName: 'Ateliê',
      slug: 'atelie',
      bio: 'Roupas feitas à mão.',
      instagram: null,
      mainCategoryId: 'cat-1',
      document: '11144477735',
      status: 'PENDING',
      pixKey: { type: 'EMAIL', key: 'ana@atelie.dev.br', ownerName: 'Ana', ownerDocument: '***.444.777-**', verifiedAt: NOW },
      commissionBps: null,
      appliedAt: NOW,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      suspendedAt: null,
      suspensionReason: null,
    };

    const view = JSON.stringify(auditViewOf(seller));

    expect(view).toContain('"status":"PENDING"');
    expect(view).not.toContain('11144477735');
    expect(view).not.toContain('ana@atelie.dev.br');
  });
});
