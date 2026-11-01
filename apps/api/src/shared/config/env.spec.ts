import { describe, expect, it } from 'vitest';

import { InvalidEnvError, loadEnv } from './env.js';

const VALID = { DATABASE_URL: 'postgresql://vitrine:vitrine@localhost:5432/vitrine' };

describe('US-007 — A API não sobe com configuração errada', () => {
  // Dado: que falta uma variável de ambiente obrigatória (ex.: DATABASE_URL)
  // Quando: a API tenta iniciar
  // Então: ela não sobe e a mensagem diz o nome da variável que falta
  it('AC-015: variável obrigatória ausente impede a subida e é nomeada @spec:AC-015', () => {
    expect(() => loadEnv({})).toThrow(InvalidEnvError);
    expect(() => loadEnv({})).toThrow(/DATABASE_URL \(ausente\)/);
  });

  // E: nenhum valor de segredo aparece na mensagem
  it('AC-015: a mensagem nunca mostra o valor das variáveis @spec:AC-015', () => {
    const secret = 'senha-super-secreta-123';

    let message = '';
    try {
      loadEnv({ DATABASE_URL: `nao-e-uma-url-${secret}`, PORT: secret });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('DATABASE_URL (inválida)');
    expect(message).toContain('PORT (inválida)');
    expect(message).not.toContain(secret);
  });

  it('aplica os valores padrão quando a configuração é válida', () => {
    expect(loadEnv(VALID)).toEqual({
      NODE_ENV: 'development',
      PORT: 3333,
      LOG_LEVEL: 'info',
      DATABASE_URL: VALID.DATABASE_URL,
    });
  });
});
