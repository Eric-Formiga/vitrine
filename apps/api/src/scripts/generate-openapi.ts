import 'reflect-metadata';

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { OpenAPIObject } from '@nestjs/swagger';
import openapiTS, { astToString, type OpenAPI3 } from 'openapi-typescript';

import { createApp } from '../create-app.js';
import { buildOpenApiDocument } from '../shared/openapi/openapi.js';

// pnpm api:generate — grava o contrato (openapi.json) e os tipos do cliente (schema.d.ts)
// em packages/api-client. O teste do AC-032 compara os dois com o que a API gera agora.
// Vale para src/scripts (testes) e dist/scripts (comando): os dois estão a 4 níveis da raiz.
const CLIENT_DIR = new URL('../../../../packages/api-client/', import.meta.url);

export interface ContractFiles {
  'openapi.json': string;
  'src/schema.d.ts': string;
}

const TYPES_HEADER =
  '// Gerado por `pnpm api:generate` a partir de packages/api-client/openapi.json.\n' +
  '// Não edite à mão: mude a API e gere de novo.\n\n';

export async function renderContractFiles(document: OpenAPIObject): Promise<ContractFiles> {
  const types = astToString(await openapiTS(document as unknown as OpenAPI3));
  return {
    'openapi.json': `${JSON.stringify(document, null, 2)}\n`,
    'src/schema.d.ts': TYPES_HEADER + types,
  };
}

/** Arquivos guardados que não batem com o que a API gera agora (fim de linha não conta). */
export async function findStaleContractFiles(rendered: ContractFiles): Promise<(keyof ContractFiles)[]> {
  const normalize = (text: string) => text.replace(/\r\n/g, '\n');
  const stale: (keyof ContractFiles)[] = [];
  for (const [name, content] of Object.entries(rendered) as [keyof ContractFiles, string][]) {
    const saved = await readFile(new URL(name, CLIENT_DIR), 'utf8').catch(() => '');
    if (normalize(saved) !== normalize(content)) stale.push(name);
  }
  return stale;
}

// A documentação não usa banco nem Clerk: valores de mentira só para a configuração validar.
const PLACEHOLDER_ENV = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'silent',
  RUN_WORKER: 'false',
  DATABASE_URL: 'postgresql://gerador:gerador@127.0.0.1:1/gerador',
  CLERK_WEBHOOK_SECRET: 'whsec_' + Buffer.from('so-para-gerar-o-contrato').toString('base64'),
  CLERK_JWT_KEY: 'nao-usada-para-gerar-o-contrato',
  CLERK_SECRET_KEY: 'sk_' + 'nao_usada',
};

// Rodando como comando (node dist/scripts/generate-openapi.js), e não importado pelos testes.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await createApp({ env: PLACEHOLDER_ENV });
  try {
    const files = await renderContractFiles(buildOpenApiDocument(app));
    for (const [name, content] of Object.entries(files)) {
      await writeFile(new URL(name, CLIENT_DIR), content);
      console.log(`✔ ${fileURLToPath(new URL(name, CLIENT_DIR))}`);
    }
  } finally {
    await app.close();
  }
}
