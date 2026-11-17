import { describe, expect, it } from 'vitest';

import { InvalidEnvError, loadEnv } from './env.js';

const VALID = {
  DATABASE_URL: 'postgresql://vitrine:vitrine@localhost:5432/vitrine',
  CLERK_WEBHOOK_SECRET: 'whsec_' + 'teste',
  CLERK_JWT_KEY: '-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----',
  CLERK_SECRET_KEY: 'sk_' + 'teste',
  SELLER_DOCUMENT_KEY: Buffer.alloc(32, 1).toString('base64'),
};

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
      RUN_WORKER: true,
      CLERK_WEBHOOK_SECRET: VALID.CLERK_WEBHOOK_SECRET,
      CLERK_JWT_KEY: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
      CLERK_SECRET_KEY: VALID.CLERK_SECRET_KEY,
      CLERK_AUTHORIZED_PARTIES: ['http://localhost:3000'],
      ASAAS_API_URL: 'https://api-sandbox.asaas.com/v3',
      SUPABASE_STORAGE_BUCKET: 'product-images',
      SELLER_DOCUMENT_KEY: VALID.SELLER_DOCUMENT_KEY,
    });
  });

  it('a chave dos documentos das lojas é obrigatória e precisa ter 32 bytes em base64', () => {
    const semChave: Record<string, string> = { ...VALID };
    delete semChave.SELLER_DOCUMENT_KEY;
    expect(() => loadEnv(semChave)).toThrow(/SELLER_DOCUMENT_KEY \(ausente\)/);
    expect(() => loadEnv({ ...VALID, SELLER_DOCUMENT_KEY: Buffer.alloc(16).toString('base64') })).toThrow(
      /SELLER_DOCUMENT_KEY \(inválida\)/,
    );
    expect(() => loadEnv({ ...VALID, SELLER_DOCUMENT_KEY: 'não é base64!' })).toThrow(/SELLER_DOCUMENT_KEY \(inválida\)/);
  });

  it('sem as variáveis do Asaas a API sobe; o token do webhook precisa de 32 caracteres', () => {
    expect(loadEnv(VALID).ASAAS_API_KEY).toBeUndefined();
    expect(() => loadEnv({ ...VALID, ASAAS_WEBHOOK_TOKEN: 'curto' })).toThrow(/ASAAS_WEBHOOK_TOKEN \(inválida\)/);
    expect(() => loadEnv({ ...VALID, ASAAS_API_URL: 'http://api-sandbox.asaas.com/v3' })).toThrow(/ASAAS_API_URL/);
  });

  it('sem as variáveis do Supabase a API sobe; o bucket tem padrão e a URL precisa ser https', () => {
    const env = loadEnv(VALID);
    expect([env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.SUPABASE_STORAGE_BUCKET]).toEqual([undefined, undefined, 'product-images']);
    expect(() => loadEnv({ ...VALID, SUPABASE_URL: 'http://projeto.supabase.co' })).toThrow(/SUPABASE_URL \(inválida\)/);
  });

  it('aceita várias origens autorizadas separadas por vírgula', () => {
    const env = loadEnv({ ...VALID, CLERK_AUTHORIZED_PARTIES: 'http://localhost:3000, http://localhost:3001' });
    expect(env.CLERK_AUTHORIZED_PARTIES).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('RUN_WORKER aceita "false" para a API só enfileirar', () => {
    expect(loadEnv({ ...VALID, RUN_WORKER: 'false' }).RUN_WORKER).toBe(false);
  });
});
