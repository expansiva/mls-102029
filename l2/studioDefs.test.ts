/// <mls fileReference="_102029_/l2/studioDefs.test.ts" enhancement="_blank" />

import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  readStudioDefs,
  removeStudioProvider,
  writeStudioProviderToken,
} from '/_102029_/l2/studioDefs.js';

type MemStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function installStorage(): Map<string, string> {
  const storage = new Map<string, string>();
  const localStorage: MemStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
    removeItem: (key) => { storage.delete(key); },
  };
  Object.assign(globalThis, { localStorage });
  return storage;
}

function stored(): { github?: { token: string }; gitlab?: { token: string } } {
  const raw = (globalThis as { localStorage: MemStorage }).localStorage.getItem('studio_defs');
  return raw ? JSON.parse(raw) as { github?: { token: string }; gitlab?: { token: string } } : {};
}

describe('studio_defs', { concurrency: false }, () => {
  const original = {
    localStorage: (globalThis as { localStorage?: unknown }).localStorage,
    error: console.error,
  };
  const errors: string[] = [];

  afterEach(() => {
    Object.assign(globalThis, { localStorage: original.localStorage });
    console.error = original.error;
    errors.length = 0;
  });

  test('writes and reads a provider token', () => {
    const storage = installStorage();
    writeStudioProviderToken('gitlab', 'gl-1');
    writeStudioProviderToken('github', 'gh-1');
    assert.deepEqual(readStudioDefs(), {
      github: { token: 'gh-1' },
      gitlab: { token: 'gl-1' },
    });
    assert.equal(storage.has('keyGitHub'), false);
    assert.equal(storage.has('keyGitLab'), false);
  });

  test('remove drops one provider and its legacy key', () => {
    const storage = installStorage();
    writeStudioProviderToken('github', 'gh-1');
    writeStudioProviderToken('gitlab', 'gl-1');
    storage.set('keyGitHub', 'legacy-gh');
    removeStudioProvider('github');
    assert.equal(storage.has('keyGitHub'), false);
    assert.deepEqual(stored(), { gitlab: { token: 'gl-1' } });
    assert.deepEqual(readStudioDefs(), { gitlab: { token: 'gl-1' } });
    removeStudioProvider('gitlab');
    assert.equal(storage.has('studio_defs'), false);
    assert.deepEqual(readStudioDefs(), {});
  });

  test('migrates a legacy key when studio_defs has no provider', () => {
    const storage = installStorage();
    storage.set('studio_defs', JSON.stringify({ gitlab: { token: 'gl-keep' } }));
    storage.set('keyGitHub', 'gh-old');
    storage.set('keyGitLab', 'gl-old');
    assert.deepEqual(readStudioDefs(), {
      github: { token: 'gh-old' },
      gitlab: { token: 'gl-keep' },
    });
    assert.equal(storage.has('keyGitHub'), false);
    assert.equal(storage.get('keyGitLab'), 'gl-old');
  });

  test('invalid JSON is empty, logged, and never prints the token', () => {
    const storage = installStorage();
    console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
    storage.set('studio_defs', '{"github":{"token":"ghp_SECRETTOKEN"}');
    assert.deepEqual(readStudioDefs(), {});
    assert.equal(storage.get('studio_defs'), '{"github":{"token":"ghp_SECRETTOKEN"}');
    storage.set('studio_defs', '["ghp_SECRETTOKEN"]');
    assert.deepEqual(readStudioDefs(), {});
    const log = errors.join('\n');
    assert.match(log, /not valid JSON \(SyntaxError\)/);
    assert.match(log, /not a JSON object/);
    assert.equal(log.includes('ghp_SECRETTOKEN'), false);
  });

  test('a legacy key still migrates when the stored JSON is invalid', () => {
    const storage = installStorage();
    console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
    storage.set('studio_defs', '{"github":{"token":"ghp_SECRETTOKEN"}');
    storage.set('keyGitLab', 'gl-old');
    assert.deepEqual(readStudioDefs(), { gitlab: { token: 'gl-old' } });
    assert.equal(storage.has('keyGitLab'), false);
    assert.equal(errors.join('\n').includes('ghp_SECRETTOKEN'), false);
    assert.equal(stored().gitlab?.token, 'gl-old');
  });
});
