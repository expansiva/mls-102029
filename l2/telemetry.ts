/// <mls fileReference="_102029_/l2/telemetry.ts" enhancement="_blank" />

export interface ClientTelemetryEvent {
  eventType: string;
  label: string;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
  recordedAt: string;
}

const IDB_DB_NAME = 'collab-telemetry';
const IDB_STORE = 'events';
const IDB_VERSION = 1;
const QUEUE_CAP = 50;
const BEACON_URL = '/execBff';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbReadAll(): Promise<ClientTelemetryEvent[]> {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => resolve((req.result as ClientTelemetryEvent[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // best-effort
  }
}

async function idbAdd(event: ClientTelemetryEvent): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).add(event);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // best-effort
  }
}

// Frontend error capture guards: keep the signal, drop the noise.
const ERROR_STACK_MAX_CHARS = 4000;
const ERROR_SESSION_CAP = 20; // max error events pushed per page session
const ERROR_REPEAT_RESEND_MAX = 3; // after this many repeats, only count locally

function truncateStack(stack: string | undefined | null): string | undefined {
  if (!stack) return undefined;
  return stack.length > ERROR_STACK_MAX_CHARS ? `${stack.slice(0, ERROR_STACK_MAX_CHARS)}\n[truncated]` : stack;
}

function isBrowserExtensionSource(...sources: Array<string | undefined | null>): boolean {
  return sources.some((s) => !!s && (s.includes('chrome-extension://') || s.includes('moz-extension://') || s.includes('safari-extension://')));
}

class TelemetryQueue {
  private queue: ClientTelemetryEvent[] = [];
  private userId = 'anonymous';
  private errorCounts = new Map<string, number>();
  private errorEventsPushed = 0;

  constructor() {
    if (typeof globalThis.window === 'undefined') {
      return;
    }
    // Recover events from a previous crash on next page load
    void idbReadAll().then((recovered) => {
      if (recovered.length > 0) {
        for (const ev of recovered) {
          this.queue.push(ev);
        }
        if (this.queue.length > QUEUE_CAP) {
          this.queue.splice(0, this.queue.length - QUEUE_CAP);
        }
        void idbClear();
      }
    });

    window.addEventListener('error', (ev) => {
      this.pushError('js_error', ev.message ?? 'Unknown error', {
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        stack: truncateStack((ev.error as Error | undefined)?.stack),
      });
    });

    window.addEventListener('unhandledrejection', (ev) => {
      const reason = ev.reason as Error | undefined;
      const msg = reason instanceof Error ? reason.message : String(ev.reason ?? 'Unhandled rejection');
      this.pushError('unhandled_rejection', msg, {
        stack: truncateStack(reason instanceof Error ? reason.stack : undefined),
      });
    });

    window.addEventListener('beforeunload', () => {
      if (this.queue.length > 0) {
        this.sendBeacon();
      }
    });
  }

  /**
   * Error-specific push: dedupes repeats (same message/source) bumping a
   * repeatCount instead of flooding, skips browser-extension noise, caps the
   * session volume, and never throws (an error handler must not error).
   */
  private pushError(eventType: string, label: string, metadata: { filename?: string; lineno?: number; colno?: number; stack?: string }): void {
    try {
      if (isBrowserExtensionSource(metadata.filename, metadata.stack)) return;

      const key = `${eventType}|${label}|${metadata.filename ?? ''}|${metadata.lineno ?? ''}`;
      const count = (this.errorCounts.get(key) ?? 0) + 1;
      this.errorCounts.set(key, count);

      if (count > 1) {
        // Same error again: if its twin is still queued, just bump the counter.
        const queued = this.queue.find((e) => e.metadata?.dedupeKey === key);
        if (queued?.metadata) {
          queued.metadata.repeatCount = count;
          return;
        }
        // Already flushed: re-report a few times (with the updated count), then only count.
        if (count > ERROR_REPEAT_RESEND_MAX) return;
      }

      if (this.errorEventsPushed >= ERROR_SESSION_CAP) return;
      this.errorEventsPushed += 1;
      this.push({
        eventType,
        label,
        metadata: { ...metadata, repeatCount: count, dedupeKey: key },
        recordedAt: new Date().toISOString(),
      });
      this.scheduleErrorFlush();
    } catch {
      // never throw from the error path
    }
  }

  private errorFlushTimer: number | null = null;

  /** Coalesce error bursts: wait 1s before the beacon so repeats dedupe into the queued event. */
  private scheduleErrorFlush(): void {
    if (this.errorFlushTimer !== null) return;
    this.errorFlushTimer = window.setTimeout(() => {
      this.errorFlushTimer = null;
      this.sendBeacon();
    }, 1000);
  }

  setUserId(id: string): void {
    this.userId = id;
  }

  push(event: ClientTelemetryEvent): void {
    const stamped: ClientTelemetryEvent = {
      ...event,
      recordedAt: event.recordedAt ?? new Date().toISOString(),
    };
    this.queue.push(stamped);
    if (this.queue.length > QUEUE_CAP) {
      this.queue.shift();
    }
    void idbAdd(stamped);
  }

  flush(): ClientTelemetryEvent[] {
    const events = this.queue.splice(0, this.queue.length);
    void idbClear();
    return events;
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.push({
        eventType: 'measure',
        label,
        durationMs: Date.now() - start,
        recordedAt: new Date().toISOString(),
      });
    }
  }

  private sendBeacon(): void {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
      return;
    }
    const events = this.flush();
    if (events.length === 0) {
      return;
    }
    const body = JSON.stringify({
      routine: 'monitor.telemetry.flush',
      params: {},
      meta: {
        source: 'http',
        userId: this.userId,
        telemetry: events,
      },
    });
    navigator.sendBeacon(BEACON_URL, new Blob([body], { type: 'application/json' }));
  }
}

export const telemetryQueue = new TelemetryQueue();
