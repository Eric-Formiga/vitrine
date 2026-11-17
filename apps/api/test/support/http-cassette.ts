import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// "Cassete" de HTTP (ASM-012): grava as conversas reais com uma API externa e depois
// as reproduz. Com RECORD ligado, chama a API de verdade e salva cada requisição e
// resposta; sem ele, devolve as respostas gravadas, sem rede e sem chave.
// Nada sensível é salvo: os cabeçalhos da requisição (onde vão as chaves) ficam de fora,
// os campos `apiKey` e `creditCardToken` das respostas viram "[removida]", e todo token
// JWT (ex.: o da URL assinada do Storage) perde a assinatura, que é o que o faz valer.
// O conteúdo do token fica, para o código ainda ler dele a validade.

export interface Interaction {
  method: string;
  /** Caminho relativo à URL base, com a query: "/accounts?email=x". */
  path: string;
  requestBody?: unknown;
  status: number;
  responseBody: unknown;
}

export interface Cassette {
  fetch: typeof fetch;
  /** Interações desta execução (gravadas ou reproduzidas), em ordem. */
  readonly calls: readonly Interaction[];
  /**
   * Valor que precisa ser novo a cada gravação (ex.: referência de um repasse, que o
   * provedor não aceita repetir) e igual ao gravado na reprodução.
   */
  value: (name: string, generate: () => string) => string;
  /** Grava o arquivo (no modo gravação) ou confere que todas as gravadas foram usadas. */
  done: () => void;
}

/** Arquivo do cassete: só a lista de interações, ou ela mais os valores gerados na gravação. */
type CassetteFile = Interaction[] | { values: Record<string, string>; interactions: Interaction[] };

const REDACTED = '[removida]';
/** Campos de resposta que dão acesso a algo (chave de API, token de cartão para cobrar de novo). */
const SECRET_FIELDS = new Set(['apiKey', 'creditCardToken']);

export interface CassetteOptions {
  baseUrl: string;
  record: boolean;
  /**
   * Campos do corpo enviado que mudam a cada rodada (ex.: vencimento = hoje) e por isso
   * não entram na conferência da reprodução. Todo o resto precisa bater com o gravado.
   */
  volatileRequestFields?: string[];
  /** Variável que liga a gravação, citada nas mensagens de erro. Padrão: ASAAS_RECORD. */
  recordVariable?: string;
}

export function createCassette(
  file: string | URL,
  { baseUrl, record, volatileRequestFields = [], recordVariable = 'ASAAS_RECORD' }: CassetteOptions,
): Cassette {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  const calls: Interaction[] = [];
  const relative = (url: string) => withoutJwtSignatures(url.replace(baseUrl.replace(/\/$/, ''), '') || '/');
  const rerecord = `Regrave com ${recordVariable}=1.`;

  if (record) {
    const recordingFetch: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      const requestBody = describeBody(init?.body);
      const response = await fetch(request);
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as unknown) : null;
      calls.push({
        method: request.method,
        path: relative(request.url),
        ...(requestBody === undefined ? {} : { requestBody }),
        status: response.status,
        responseBody: redact(parsed),
      });
      // A resposta real segue para o código; só a cópia gravada é limpa.
      return new Response(text, { status: response.status, headers: response.headers });
    };
    const values: Record<string, string> = {};
    return {
      fetch: recordingFetch,
      calls,
      value: (name, generate) => (values[name] ??= generate()),
      done: () => {
        const stored: CassetteFile = Object.keys(values).length ? { values, interactions: calls } : calls;
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(stored, null, 2)}\n`);
      },
    };
  }

  if (!existsSync(path)) {
    throw new Error(`Cassete não encontrado: ${path}. Grave com ${recordVariable}=1 (precisa das chaves no .env).`);
  }
  const stored = JSON.parse(readFileSync(path, 'utf8')) as CassetteFile;
  const recorded = Array.isArray(stored) ? stored : stored.interactions;
  const recordedValues = Array.isArray(stored) ? {} : stored.values;
  let next = 0;

  const replayingFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const expected = recorded[next];
    const actual = `${request.method} ${relative(request.url)}`;
    if (!expected) throw new Error(`Requisição a mais, fora do cassete ${path}: ${actual}`);
    if (`${expected.method} ${expected.path}` !== actual) {
      throw new Error(`O cassete ${path} esperava "${expected.method} ${expected.path}" na posição ${next}, veio "${actual}". ${rerecord}`);
    }
    // O corpo enviado também precisa bater: sem isso, o adaptador poderia parar de mandar
    // um campo (ex.: externalReference) e a resposta gravada esconderia o defeito.
    const sentBody = describeBody(init?.body);
    const sent = JSON.stringify(withoutFields(sentBody, volatileRequestFields));
    const recordedBody = JSON.stringify(withoutFields(expected.requestBody, volatileRequestFields));
    if (sent !== recordedBody) {
      throw new Error(`O corpo de "${actual}" (posição ${next}) não bate com o cassete ${path}.\n  enviado: ${sent}\n  gravado: ${recordedBody}`);
    }
    next += 1;
    calls.push(expected);
    return new Response(JSON.stringify(expected.responseBody), {
      status: expected.status,
      headers: { 'content-type': 'application/json' },
    });
  };

  return {
    fetch: replayingFetch,
    calls,
    value: (name) => {
      const recordedValue = recordedValues[name];
      if (recordedValue === undefined) throw new Error(`O cassete ${path} não tem o valor "${name}". ${rerecord}`);
      return recordedValue;
    },
    done: () => {
      if (next !== recorded.length) {
        throw new Error(`O cassete ${path} tem ${recorded.length} requisições, mas só ${next} foram feitas. ${rerecord}`);
      }
    },
  };
}

/** O corpo enviado, como fica no cassete: JSON lido; arquivo (binário) só pelo tamanho. */
function describeBody(body: RequestInit['body']): unknown {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return body;
    }
  }
  if (body instanceof Blob) return { binaryBytes: body.size };
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return { binaryBytes: body.byteLength };
  throw new Error('O cassete não sabe gravar este tipo de corpo.');
}

const JWT = /(eyJ[\w-]*\.[\w-]*)\.[\w-]+/g;

/** Mantém cabeçalho e conteúdo do JWT e tira a assinatura: o token não vale mais nada. */
function withoutJwtSignatures(text: string): string {
  return text.replace(JWT, '$1.assinatura-removida');
}

/** Cópia do corpo sem os campos voláteis (só no primeiro nível, onde eles ficam). */
function withoutFields(body: unknown, fields: string[]): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  return Object.fromEntries(Object.entries(body).filter(([key]) => !fields.includes(key)));
}

function redact(value: unknown): unknown {
  if (typeof value === 'string') return withoutJwtSignatures(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_FIELDS.has(key) ? REDACTED : redact(inner)]),
    );
  }
  return value;
}
