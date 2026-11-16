import { describe, expect, it } from 'vitest';

import { RequestValidationError } from '../errors/domain-error.js';
import { etagOf, parseIfMatch, PreconditionRequiredError } from './if-match.js';

describe('If-Match', () => {
  it('lê a versão do ETag forte, do fraco e do número puro', () => {
    expect(parseIfMatch('"3"')).toBe(3);
    expect(parseIfMatch('W/"12"')).toBe(12);
    expect(parseIfMatch(' 7 ')).toBe(7);
    expect(parseIfMatch(etagOf(41))).toBe(41);
  });

  it('sem o cabeçalho é 428; fora do formato é 400', () => {
    expect(() => parseIfMatch(undefined)).toThrow(PreconditionRequiredError);
    expect(() => parseIfMatch('')).toThrow(PreconditionRequiredError);
    for (const header of ['"abc"', '"0"', '*', '"3", "4"', '-1']) {
      expect(() => parseIfMatch(header), header).toThrow(RequestValidationError);
    }
  });
});
