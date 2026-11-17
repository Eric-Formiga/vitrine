import { describe, expect, it } from 'vitest';

import { isInSellerFolder, MAX_UPLOAD_BYTES, storedFileProblem, uploadPath } from './upload.js';

const LOJA = '0195a1b2-0000-7000-8000-000000000001';

describe('upload', () => {
  it('o arquivo vai para a pasta da loja, com nome aleatório e a extensão do tipo', () => {
    expect(uploadPath(LOJA, 'image/jpeg', 'abc')).toBe(`sellers/${LOJA}/abc.jpg`);
    expect(uploadPath(LOJA, 'image/webp', 'abc')).toBe(`sellers/${LOJA}/abc.webp`);
  });

  it('só aceita arquivos direto na pasta da própria loja', () => {
    expect(isInSellerFolder(`sellers/${LOJA}/abc.webp`, LOJA)).toBe(true);
    expect(isInSellerFolder(`sellers/outra-loja/abc.webp`, LOJA)).toBe(false);
    expect(isInSellerFolder(`sellers/${LOJA}/../outra/abc.webp`, LOJA)).toBe(false);
    expect(isInSellerFolder(`sellers/${LOJA}/sub/abc.webp`, LOJA)).toBe(false);
    expect(isInSellerFolder(`sellers/${LOJA}/`, LOJA)).toBe(false);
  });

  it('confere o arquivo real: tipo de imagem aceito e até 5 MB', () => {
    expect(storedFileProblem({ contentType: 'image/png', sizeBytes: MAX_UPLOAD_BYTES })).toBeNull();
    expect(storedFileProblem({ contentType: 'image/gif', sizeBytes: 100 })).toBe('type');
    expect(storedFileProblem({ contentType: 'image/png', sizeBytes: MAX_UPLOAD_BYTES + 1 })).toBe('size');
    expect(storedFileProblem({ contentType: 'image/png', sizeBytes: 0 })).toBe('size');
  });
});
