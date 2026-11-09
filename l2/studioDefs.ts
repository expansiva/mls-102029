/// <mls fileReference="_102029_/l2/studioDefs.ts" enhancement="_blank" />

const STUDIO_DEFS_KEY = 'studio_defs';

export type StudioProvider = 'github' | 'gitlab';

export interface StudioProviderDef {
  token: string;
}

export interface StudioDefs {
  github?: StudioProviderDef;
  gitlab?: StudioProviderDef;
}

const PROVIDERS: readonly StudioProvider[] = ['github', 'gitlab'];

const LEGACY_KEY: Record<StudioProvider, string> = {
  github: 'keyGitHub',
  gitlab: 'keyGitLab',
};

function storageBox(): Storage | null {
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  if (!storage) {
    console.error('[studioDefs] localStorage is unavailable');
    return null;
  }
  return storage;
}

function tokenOf(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const token = (value as { token?: unknown }).token;
  if (typeof token !== 'string' || token.length === 0) return null;
  return token;
}

function parseStored(raw: string): StudioDefs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown';
    console.error(`[studioDefs] studio_defs is not valid JSON (${name})`);
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error('[studioDefs] studio_defs is not a JSON object');
    return {};
  }
  const record = parsed as Record<string, unknown>;
  const defs: StudioDefs = {};
  for (const provider of PROVIDERS) {
    const token = tokenOf(record[provider]);
    if (token) defs[provider] = { token };
  }
  return defs;
}

function persist(storage: Storage, defs: StudioDefs): void {
  if (!defs.github && !defs.gitlab) {
    storage.removeItem(STUDIO_DEFS_KEY);
    return;
  }
  storage.setItem(STUDIO_DEFS_KEY, JSON.stringify(defs));
}

function load(storage: Storage): StudioDefs {
  const raw = storage.getItem(STUDIO_DEFS_KEY);
  const defs: StudioDefs = raw === null ? {} : parseStored(raw);
  let migrated = false;
  for (const provider of PROVIDERS) {
    if (defs[provider]) continue;
    const legacy = storage.getItem(LEGACY_KEY[provider]);
    if (!legacy) continue;
    defs[provider] = { token: legacy };
    storage.removeItem(LEGACY_KEY[provider]);
    migrated = true;
  }
  if (migrated) persist(storage, defs);
  return defs;
}

export function readStudioDefs(): StudioDefs {
  const storage = storageBox();
  if (!storage) return {};
  return load(storage);
}

export function writeStudioProviderToken(provider: StudioProvider, token: string): void {
  const storage = storageBox();
  if (!storage) return;
  const defs = load(storage);
  defs[provider] = { token };
  persist(storage, defs);
}

export function removeStudioProvider(provider: StudioProvider): void {
  const storage = storageBox();
  if (!storage) return;
  const defs = load(storage);
  delete defs[provider];
  storage.removeItem(LEGACY_KEY[provider]);
  persist(storage, defs);
}
