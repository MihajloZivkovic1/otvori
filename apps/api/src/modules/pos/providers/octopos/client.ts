import { z } from 'zod';
import { logger } from '../../../../utils/logger.js';
import { PosProviderError, type PosErrorKind } from '../types.js';
import { OPERATIONS, type OperationId, type Operations } from './generated.js';

/*
 * Typed HTTP client for the Octopos REST API, on top of the types generated from docs/octopos/openapi.json.
 * What the spec does not say but the sandbox does (verified on 2026-10-26, fixtures in test/fixtures/octopos):
 *
 *   - every JSON answer is an envelope { Success, Errors[], Warnings[], Data }; errors come as HTTP 400 with
 *     Success=false and human-readable Serbian/English strings in Errors; a few handler crashes come as 400 with
 *     "Server error" + a .NET stack trace, and some routes answer 500 text/plain or 404 { Message };
 *   - a wrong or missing key is a 401 with an empty body — but only on routes that check it (/WebOrder/*,
 *     /Currency/System); /Ping, /Tax, /Table/* and /Product answer without a key on the sandbox;
 *   - `Authorization: Basic <token>` as the spec says; `Bearer <token>` is accepted too.
 *
 * Responses are untrusted input: callers hand in a Zod schema for `Data` (coercing numbers, tolerating extra
 * fields) and get a `PosProviderError` with a `kind` and `retryable` flag for everything that goes wrong.
 */

export interface OctoposClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** The header value: a bare token is sent as `Basic <token>`; a value that already names a scheme is sent as is. */
export function authorizationHeader(apiKey: string): string {
  return /^(basic|bearer)\s/i.test(apiKey) ? apiKey : `Basic ${apiKey}`;
}

const envelopeSchema = z.object({
  Success: z.boolean(),
  Errors: z.array(z.unknown()).default([]),
  Warnings: z.array(z.unknown()).default([]),
  Data: z.unknown().optional(),
});

/** Known refusals the callers want to recognise (matched on the register's message text). */
export const OCTOPOS_ERROR_CODES = {
  duplicateExternalId: /already bill with same external id/i,
  alreadyClosed: /already printed/i,
  notFound: /^Resource not found$/i,
  unknownProduct: /^Product not found/i,
  invalidTable: /^Invalid table/i,
  amountMismatch: /Total payment amount is not the same/i,
  invalidTaxLabel: /Neispravne poreske stope/i,
} as const;
export type OctoposErrorCode = keyof typeof OCTOPOS_ERROR_CODES;

export class OctoposError extends PosProviderError {
  constructor(
    kind: PosErrorKind,
    message: string,
    public readonly errors: string[] = [],
    public readonly status: number | null = null,
    public readonly reason: OctoposErrorCode | null = null,
  ) {
    super(kind, message);
    this.name = 'OctoposError';
  }
}

function classify(errors: string[]): { kind: PosErrorKind; reason: OctoposErrorCode | null } {
  for (const [reason, pattern] of Object.entries(OCTOPOS_ERROR_CODES) as [OctoposErrorCode, RegExp][]) {
    if (errors.some((e) => pattern.test(e))) return { kind: reason === 'notFound' ? 'not_found' : 'rejected', reason };
  }
  if (errors.some((e) => /^Server error$/i.test(e))) return { kind: 'server', reason: null };
  return { kind: 'rejected', reason: null };
}

function fillPath(path: string, params: Record<string, string | number> | undefined): string {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`Missing path parameter ${name} for ${path}`);
    return encodeURIComponent(String(value));
  });
}

type Args<K extends OperationId> = {
  pathParams?: Operations[K]['pathParams'];
  query?: Operations[K]['query'];
  body?: Operations[K]['body'];
};

export class OctoposClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OctoposClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Calls an operation and returns the envelope's `Data` parsed with `schema`. */
  async call<K extends OperationId, T extends z.ZodTypeAny>(id: K, args: Args<K>, schema: T): Promise<z.infer<T>> {
    const op = OPERATIONS[id];
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries((args.query ?? {}) as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) value.forEach((v) => query.append(key, String(v)));
      else query.set(key, String(value));
    }
    const qs = query.toString();
    const url = `${this.baseUrl}${fillPath(op.path, args.pathParams as Record<string, string | number> | undefined)}${qs ? `?${qs}` : ''}`;
    const hasBody = args.body !== undefined;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: op.method,
        headers: {
          Accept: 'application/json',
          Authorization: authorizationHeader(this.apiKey),
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(args.body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new OctoposError(
        timedOut ? 'timeout' : 'unreachable',
        timedOut ? `The register did not answer within ${Math.round(this.timeoutMs / 1000)} s` : `Could not reach the register (${error instanceof Error ? error.message : 'network error'})`,
      );
    }

    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new OctoposError('auth', 'The register rejected the API key', [], response.status);
    }
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new OctoposError(response.status >= 500 ? 'server' : 'shape', `The register answered ${response.status} without JSON: ${text.slice(0, 120)}`, [], response.status);
    }
    const envelope = envelopeSchema.safeParse(json);
    if (!envelope.success) {
      // e.g. 404 { Message: "No HTTP resource was found …" }
      const message = (json as { Message?: unknown } | null)?.Message;
      throw new OctoposError(
        response.status === 404 ? 'not_found' : response.status >= 500 ? 'server' : 'shape',
        typeof message === 'string' ? message : `Unexpected answer from the register (${response.status})`,
        [],
        response.status,
      );
    }
    if (!response.ok || !envelope.data.Success) {
      const errors = envelope.data.Errors.map((e) => (typeof e === 'string' ? e : JSON.stringify(e)));
      const { kind, reason } = classify(errors);
      const summary = errors.map((e) => e.split('\r\n')[0]).join('; ') || `HTTP ${response.status}`;
      throw new OctoposError(kind, `The register refused the request: ${summary}`, errors, response.status, reason);
    }
    const parsed = schema.safeParse(envelope.data.Data);
    if (!parsed.success) {
      logger.warn({ operation: id, status: response.status, body: text.slice(0, 300) }, 'Unexpected Octopos response shape');
      throw new OctoposError('shape', `Unexpected answer from the register for ${id}`, [], response.status);
    }
    return parsed.data;
  }
}
