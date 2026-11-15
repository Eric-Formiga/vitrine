import { describe, expect, it } from 'vitest';

import { AesDocumentVault } from './aes-document-vault.js';

const vault = (byte: number) => new AesDocumentVault({ SELLER_DOCUMENT_KEY: Buffer.alloc(32, byte).toString('base64') });

describe('Cofre do CPF/CNPJ das lojas', () => {
  it('cifra e decifra de volta, sem deixar o documento visível', () => {
    const sealed = vault(1).seal('11144477735');

    expect(sealed.encrypted).not.toContain('11144477735');
    expect(vault(1).open(sealed.encrypted)).toBe('11144477735');
  });

  it('o mesmo documento cifrado duas vezes dá textos diferentes, mas o mesmo hash', () => {
    const a = vault(1).seal('11144477735');
    const b = vault(1).seal('11144477735');

    expect(a.encrypted).not.toBe(b.encrypted);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).not.toBe(vault(1).hash('52998224725'));
  });

  it('com outra chave, não abre e o hash muda', () => {
    const sealed = vault(1).seal('11144477735');

    expect(() => vault(2).open(sealed.encrypted)).toThrow();
    expect(vault(2).hash('11144477735')).not.toBe(sealed.hash);
  });

  it('texto cifrado adulterado é recusado (GCM confere a integridade)', () => {
    const [version, iv, tag, ciphertext] = vault(1).seal('11144477735').encrypted.split(':');
    const flipped = Buffer.from(ciphertext!, 'base64');
    flipped[0] = flipped[0]! ^ 1;

    expect(() => vault(1).open([version, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });
});
