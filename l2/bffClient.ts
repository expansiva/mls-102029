/// <mls fileReference="_102029_/l2/bffClient.ts" enhancement="_blank" /> 
import type { MasterFrontendInteractionMode, MasterFrontendNormalizedError } from '/_102029_/l2/contracts/bootstrap.js';
import { telemetryQueue, type ClientTelemetryEvent } from '/_102029_/l2/telemetry.js';

export type { ClientTelemetryEvent };

function traceLazy(event: string, details?: Record<string, unknown>) {
  if (!globalThis.window || !window.isTraceLazy) {
    return;
  }
  console.log('[traceLazy][bff-client]', event, details ?? {});
}

export interface BffClientOptions {
  mode?: MasterFrontendInteractionMode;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface BffClientResponse<TData = unknown> {
  ok: boolean;
  data: TData | null;
  error: MasterFrontendNormalizedError | null;
  telemetryReceived?: number;
}

export interface BffClientRequest {
  routine: string;
  params: unknown;
  meta: {
    source: 'http' | 'test';
    userId: string;
    telemetry: ClientTelemetryEvent[];
  };
}

export type BffDirectResult<TData = unknown> =
  | BffClientResponse<TData>
  | {
      response: BffClientResponse<TData>;
      statusCode?: number;
    };

export interface BffDirectTransport {
  execBff<TData = unknown>(
    request: BffClientRequest,
    options?: BffClientOptions,
  ): Promise<BffDirectResult<TData>>;
}

declare global {
  interface Window {
    collabBffTransport?: BffDirectTransport;
    collabBffTransportModule?: string;
  }
}

/**
 * The logged user's EMAIL travels in `meta.userId` — the standard, because a display name is not unique
 * (decision of 2026-08-18). It is TELEMETRY: the server never authorizes by it (it discards the identity
 * fields of the meta on the http transport), so a wrong value costs an audit trail, never a permission.
 *
 * Read from the session cookie at REQUEST time rather than pushed in at boot: the runtime writes
 * `loginUser` (the email of the verified JWT) when the collab-auth login returns, which can happen after
 * the app mounted — a value captured at boot would stay stale, and every page reaches this client
 * directly, with nobody in between to refresh it. `setUserId` remains the explicit override for a host
 * that knows better (the Studio, a test).
 */
const SESSION_USER_COOKIE = 'loginUser';
let _userId = '';

function sessionUser(): string {
  try {
    const cookie = typeof document === 'undefined' ? '' : document.cookie;
    const match = new RegExp(`(?:^|;\\s*)${SESSION_USER_COOKIE}=([^;]*)`, 'u').exec(cookie);
    const value = match ? decodeURIComponent(match[1]) : '';
    return value && value !== 'anonymous' ? value : '';
  } catch {
    return '';
  }
}

/** The event the shell listens for to send the user back to the collab-auth login. */
export const BFF_UNAUTHENTICATED_EVENT = 'collab-bff-unauthenticated';

function notifyUnauthenticated(routine: string): void {
  try {
    const target = typeof window === 'undefined' ? undefined : window;
    target?.dispatchEvent(new CustomEvent(BFF_UNAUTHENTICATED_EVENT, { detail: { routine } }));
  } catch {
    // best-effort: a host without CustomEvent still gets the normalized error above
  }
}

/** The identity to report: an explicit override wins, then the session cookie, then anonymous. */
function currentUserId(): string {
  return _userId || sessionUser() || 'anonymous';
}
let importedTransportUrl: string | null = null;
let importedTransport: Promise<BffDirectTransport> | null = null;

/** Explicit override (email). Empty string clears it and the session cookie takes over again. */
export function setUserId(id: string): void {
  _userId = id;
  telemetryQueue.setUserId(id || currentUserId());
}

export function pushTelemetry(event: ClientTelemetryEvent): void {
  telemetryQueue.push(event);
}

const DEFAULT_TIMEOUT_MS = 10000;

function getBffHost() {
  return globalThis as typeof globalThis & {
    collabBffTransport?: BffDirectTransport;
    collabBffTransportModule?: string;
    window?: Window;
  };
}

function getRegisteredTransport(): BffDirectTransport | null {
  const host = getBffHost();
  return host.window?.collabBffTransport ?? host.collabBffTransport ?? null;
}

function getTransportModuleUrl(): string | null {
  const host = getBffHost();
  return host.window?.collabBffTransportModule ?? host.collabBffTransportModule ?? null;
}

function normalizeTransportModule(mod: unknown): BffDirectTransport {
  const record = mod as {
    default?: unknown;
    execBff?: unknown;
  };
  const exported = record.default ?? record;

  if (typeof exported === 'function') {
    return {
      execBff: exported as BffDirectTransport['execBff'],
    };
  }

  if (exported && typeof exported === 'object' && typeof (exported as BffDirectTransport).execBff === 'function') {
    return exported as BffDirectTransport;
  }

  if (typeof record.execBff === 'function') {
    return {
      execBff: record.execBff as BffDirectTransport['execBff'],
    };
  }

  throw new Error('BFF transport module must export execBff or a default transport');
}

async function resolveDirectTransport(): Promise<BffDirectTransport | null> {
  const registered = getRegisteredTransport();
  if (registered) {
    return registered;
  }

  const moduleUrl = getTransportModuleUrl();
  if (!moduleUrl) {
    return null;
  }

  if (!importedTransport || importedTransportUrl !== moduleUrl) {
    importedTransportUrl = moduleUrl;
    importedTransport = import(moduleUrl)
      .then(normalizeTransportModule)
      .catch((error) => {
        if (importedTransportUrl === moduleUrl) {
          importedTransportUrl = null;
          importedTransport = null;
        }
        throw error;
      });
  }

  return importedTransport;
}

function createRequest(
  routine: string,
  params: unknown,
  source: BffClientRequest['meta']['source'],
): BffClientRequest {
  return {
    routine,
    params,
    meta: {
      source,
      userId: currentUserId(),
      telemetry: telemetryQueue.flush(),
    },
  };
}

function unwrapDirectResult<TData>(result: BffDirectResult<TData>): BffClientResponse<TData> {
  if (result && typeof result === 'object' && 'response' in result) {
    return result.response;
  }
  return result as BffClientResponse<TData>;
}

function withAbort<TValue>(operation: Promise<TValue>, signal: AbortSignal): Promise<TValue> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error('aborted'));
  }

  return new Promise<TValue>((resolve, reject) => {
    const handleAbort = () => {
      reject(signal.reason ?? new Error('aborted'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
    operation
      .then(resolve, reject)
      .finally(() => {
        signal.removeEventListener('abort', handleAbort);
      });
  });
}

function parseBffEnvelope<TData>(bodyText: string): BffClientResponse<TData> | null {
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    if (typeof (parsed as { ok?: unknown }).ok !== 'boolean') return null;
    return parsed as BffClientResponse<TData>;
  } catch {
    return null;
  }
}

function httpTransportError(status: number, bodyText: string): MasterFrontendNormalizedError {
  return {
    code: `HTTP_${status}`,
    message: status === 404
      ? 'Rotina ou servico nao encontrado (404).'
      : `Erro do servidor (${status}).`,
    details: bodyText.slice(0, 300),
  };
}

export async function execBff<TData = unknown>(
  routine: string,
  params: unknown,
  options: BffClientOptions = {},
): Promise<BffClientResponse<TData>> {
  const controller = new AbortController();
  const cleanupTimeout = globalThis.setTimeout(() => {
    controller.abort(new Error('TIMEOUT'));
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;

  try {
    traceLazy('request.start', {
      routine,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      mode: options.mode ?? 'silent',
    });

    const directTransport = await withAbort(resolveDirectTransport(), signal);
    if (directTransport) {
      traceLazy('request.direct.start', {
        routine,
      });
      const result = await withAbort(
        directTransport.execBff<TData>(createRequest(routine, params, 'test'), {
          ...options,
          signal,
        }),
        signal,
      );
      traceLazy('request.direct.response', {
        routine,
      });
      return unwrapDirectResult(result);
    }

    const response = await fetch('/execBff', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(createRequest(routine, params, 'http')),
      signal,
    });

    traceLazy('request.response', {
      routine,
      status: response.status,
    });

    // Read the body as text first so a non-JSON response (e.g. a 404 HTML error page, common
    // when the BFF route/backend is unavailable) becomes a clean normalized error instead of
    // a "Unexpected token '<'" JSON parse exception.
    const bodyText = await response.text();
    const envelope = parseBffEnvelope<TData>(bodyText);

    if (!response.ok) {
      traceLazy('request.httpError', { routine, status: response.status });
      if (response.status === 401) {
        // The session died (or never existed). This client cannot log anyone in — the token lives in an
        // httpOnly cookie only the runtime writes — so it ANNOUNCES it and lets the shell drive the
        // redirect to collab-auth. Announced once per request, never a redirect from here: a library
        // navigating the page out from under the app would be the wrong owner for that decision.
        notifyUnauthenticated(routine);
      }
      // Domain failures (VALIDATION_ERROR, …) travel as HTTP 4xx WITH the BFF envelope in the body.
      // That envelope's error.message is the screen text. Replacing it with "Erro do servidor (400)"
      // threw the real message away and left only the status.
      if (envelope) return envelope;
      if (response.status === 401) {
        return {
          ok: false,
          data: null,
          error: {
            code: 'UNAUTHENTICATED',
            message: 'Sessao expirada. Entre novamente.',
            details: bodyText.slice(0, 300),
          },
        };
      }
      return {
        ok: false,
        data: null,
        error: httpTransportError(response.status, bodyText),
      };
    }

    if (envelope) return envelope;
    traceLazy('request.badResponse', { routine });
    return {
      ok: false,
      data: null,
      error: {
        code: 'BAD_RESPONSE',
        message: 'Resposta invalida do servidor (nao-JSON).',
        details: bodyText.slice(0, 300),
      },
    };
  } catch (error) {
    if (signal.aborted) {
      traceLazy('request.timeout', {
        routine,
      });
      return {
        ok: false,
        data: null,
        error: {
          code: 'TIMEOUT',
          message: 'O servidor demorou demais para responder.',
        },
      };
    }

    traceLazy('request.networkError', {
      routine,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Servidor indisponivel ou sem conexao.',
        details: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    globalThis.clearTimeout(cleanupTimeout);
  }
}
