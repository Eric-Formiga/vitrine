import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// "Cassete" de HTTP (ASM-012): grava as conversas reais com uma API externa e depois
// as reproduz. Com RECORD ligado, chama a API de verdade e salva cada requisição e
// resposta; sem ele, devolve as respostas gravadas, sem rede e sem chave.
// Nada sensível é salvo: os cabeçalhos da requisição ficam de fora e os campos
// `apiKey` e `creditCardToken` das respostas viram "[removida]".

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
  /** Grava o arquivo (no modo gravação) ou confere que todas as gravadas foram usadas. */
  done: () => void;
}

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
}

export function createCassette(file: string | URL, { baseUrl, record, volatileRequestFields = [] }: CassetteOptions): Cassette {
  const path = file instanceof URL ? fileURLToPath(file) : file;
  const calls: Interaction[] = [];
  const relative = (url: string) => url.replace(baseUrl.replace(/\/$/, ''), '') || '/';

  if (record) {
    const recordingFetch: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      const requestText = init?.body ? String(init.body) : undefined;
      const response = await fetch(request);
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as unknown) : null;
      calls.push({
        method: request.method,
        path: relative(request.url),
        ...(requestText ? { requestBody: JSON.parse(requestText) as unknown } : {}),
        status: response.status,
        responseBody: redact(parsed),
      });
      // A resposta real segue para o código; só a cópia gravada é limpa.
      return new Response(text, { status: response.status, headers: response.headers });
    };
    return {
      fetch: recordingFetch,
      calls,
      done: () => {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${JSON.stringify(calls, null, 2)}\n`);
      },
    };
  }

  if (!existsSync(path)) {
    throw new Error(`Cassete não encontrado: ${path}. Grave com ASAAS_RECORD=1 (precisa da ASAAS_API_KEY do sandbox no .env).`);
  }
  const recorded = JSON.parse(readFileSync(path, 'utf8')) as Interaction[];
  let next = 0;

  const replayingFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const expected = recorded[next];
    const actual = `${request.method} ${relative(request.url)}`;
    if (!expected) throw new Error(`Requisição a mais, fora do cassete ${path}: ${actual}`);
    if (`${expected.method} ${expected.path}` !== actual) {
      throw new Error(`O cassete ${path} esperava "${expected.method} ${expected.path}" na posição ${next}, veio "${actual}". Regrave com ASAAS_RECORD=1.`);
    }
    // O corpo enviado também precisa bater: sem isso, o adaptador poderia parar de mandar
    // um campo (ex.: externalReference) e a resposta gravada esconderia o defeito.
    const sentBody = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
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
    done: () => {
      if (next !== recorded.length) {
        throw new Error(`O cassete ${path} tem ${recorded.length} requisições, mas só ${next} foram feitas. Regrave com ASAAS_RECORD=1.`);
      }
    },
  };
}

/** Cópia do corpo sem os campos voláteis (só no primeiro nível, onde eles ficam). */
function withoutFields(body: unknown, fields: string[]): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  return Object.fromEntries(Object.entries(body).filter(([key]) => !fields.includes(key)));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SECRET_FIELDS.has(key) ? REDACTED : redact(inner)]),
    );
  }
  return value;
}
