/// <mls fileReference="_102029_/l2/mlsDepManifest.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMlsDepWorkspaceIds,
  emitMlsDepJson,
  emitMlsDepJsonIfHostDisk,
  mlsDepJsonContents,
  mlsDepPathFromL5ConfigPath,
  serializeMlsDepJson,
} from '/_102029_/l2/mlsDepManifest.js';

const L5_CONFIG = {
  workspaceDependencies: ['102047', '102020', '102021', '102027', '102029', '102036', '102025'],
};
const L5_PROJECT = {
  masters: {
    backend: { runtimeProject: 102034 },
    frontend: { runtimeProject: 102033 },
  },
};

test('mlsDep ids are the l5 list union runtimeProject masters union the Studio pair', () => {
  assert.deepEqual(
    buildMlsDepWorkspaceIds(L5_CONFIG, L5_PROJECT),
    ['100554', '100555', '102020', '102021', '102025', '102027', '102029', '102033', '102034', '102036', '102047'],
  );
});

test('runtimeProject is added even when the l5 list omitted it', () => {
  const ids = buildMlsDepWorkspaceIds({ workspaceDependencies: ['102047', '102020'] }, L5_PROJECT);
  assert.ok(ids.includes('102033'));
  assert.ok(ids.includes('102034'));
  assert.ok(ids.includes('102047'));
  assert.ok(ids.includes('102020'));
});

test('masters as strings and missing l5 list still emit the runtime projects and the Studio pair', () => {
  assert.deepEqual(
    buildMlsDepWorkspaceIds({}, { masters: { frontend: { runtimeProject: '102033' }, backend: { runtimeProject: '102034' } } }),
    ['100554', '100555', '102033', '102034'],
  );
});

test('Studio pair is in the closure even when the l5 list never mentioned it', () => {
  const ids = buildMlsDepWorkspaceIds(L5_CONFIG, L5_PROJECT);
  assert.ok(ids.includes('100554'));
  assert.ok(ids.includes('100555'));
  assert.equal(L5_CONFIG.workspaceDependencies.includes('100554'), false);
  assert.equal(L5_CONFIG.workspaceDependencies.includes('100555'), false);
});

test('Studio pair is not duplicated when the l5 list already declares it', () => {
  const ids = buildMlsDepWorkspaceIds(
    { workspaceDependencies: ['100554', '102047', '100555', '100554'] },
    L5_PROJECT,
  );
  assert.equal(ids.filter((id) => id === '100554').length, 1);
  assert.equal(ids.filter((id) => id === '100555').length, 1);
});

test('closure stays numerically sorted and has no repeats', () => {
  const ids = buildMlsDepWorkspaceIds(
    { workspaceDependencies: ['102047', '100555', '102020', '100554', '102047'] },
    L5_PROJECT,
  );
  assert.deepEqual(ids, [...ids].sort((left, right) => Number(left) - Number(right)));
  assert.equal(ids.length, new Set(ids).size);
});

test('Studio pair is added when workspaceDependencies is empty or absent', () => {
  const empty = buildMlsDepWorkspaceIds({ workspaceDependencies: [] }, {});
  const absent = buildMlsDepWorkspaceIds({}, {});
  const missingConfig = buildMlsDepWorkspaceIds(undefined, undefined);
  for (const ids of [empty, absent, missingConfig]) {
    assert.ok(ids.includes('100554'));
    assert.ok(ids.includes('100555'));
    assert.deepEqual(ids, ['100554', '100555']);
  }
});

test('serialize is stable: two calls with the same inputs are byte-identical', () => {
  const first = mlsDepJsonContents(L5_CONFIG, L5_PROJECT);
  const second = mlsDepJsonContents(L5_CONFIG, L5_PROJECT);
  assert.equal(second, first);
  assert.equal(first, serializeMlsDepJson(buildMlsDepWorkspaceIds(L5_CONFIG, L5_PROJECT)));
  assert.match(first, /\n$/);
});

test('emitMlsDepJson does not write when the bytes already match', () => {
  const dest = '/tmp/mlsDep.json';
  const expected = mlsDepJsonContents(L5_CONFIG, L5_PROJECT);
  let writes = 0;
  const wrote = emitMlsDepJson(dest, L5_CONFIG, L5_PROJECT, {
    read: () => expected,
    write: () => { writes += 1; },
  });
  assert.equal(wrote, false);
  assert.equal(writes, 0);
});

test('emitMlsDepJson writes once when the file is missing, then no-ops', () => {
  const files = new Map<string, string>();
  const io = {
    read: (path: string) => {
      const value = files.get(path);
      if (value === undefined) throw new Error('ENOENT');
      return value;
    },
    write: (path: string, source: string) => { files.set(path, source); },
  };
  const dest = 'mlsDep.json';
  assert.equal(emitMlsDepJson(dest, L5_CONFIG, L5_PROJECT, io), true);
  const first = files.get(dest);
  assert.ok(first);
  assert.equal(emitMlsDepJson(dest, L5_CONFIG, L5_PROJECT, io), false);
  assert.equal(files.get(dest), first);
});

test('mlsDep path sits at the project root next to l5/config.json', () => {
  assert.equal(mlsDepPathFromL5ConfigPath('/data/mls-base/mls-102047/l5/config.json'), '/data/mls-base/mls-102047/mlsDep.json');
  assert.equal(mlsDepPathFromL5ConfigPath('C:\\mls-base\\mls-102047\\l5\\config.json'), 'C:\\mls-base\\mls-102047\\mlsDep.json');
});

// The host's diskPath is a class method over a private field. Detaching it throws, the
// catch swallows it, and mlsDep.json is never written — the VM build then cannot resolve
// the dependency closure. Measured on the CLI host 02/09/2026.
void test('emitMlsDepJsonIfHostDisk calls diskPath as a method (host class, private field)', () => {
  class HostStor {
    readonly #base = '/data/mls-base';
    diskPath(info: { project: number; level: number; folder: string; shortName: string; extension: string }): string {
      return `${this.#base}/mls-${info.project}/l5/${info.shortName}${info.extension}`;
    }
  }
  const g = globalThis as { mls?: unknown; Deno?: unknown };
  const prevMls = g.mls;
  const prevDeno = g.Deno;
  const written: Array<{ path: string; data: string }> = [];
  g.mls = { stor: new HostStor() };
  g.Deno = { writeTextFileSync: (path: string, data: string) => { written.push({ path, data }); } };
  try {
    const wrote = emitMlsDepJsonIfHostDisk(
      102043,
      { workspaceDependencies: ['102043', '102020'] },
      { masters: { backend: { runtimeProject: 102034 }, frontend: { runtimeProject: 102033 } } },
    );
    assert.equal(wrote, true);
    assert.equal(written.length, 1);
    assert.equal(written[0]!.path, '/data/mls-base/mls-102043/mlsDep.json');
    assert.deepEqual(JSON.parse(written[0]!.data).workspaceDependencies, ['100554', '100555', '102020', '102033', '102034', '102043']);
  } finally {
    g.mls = prevMls;
    g.Deno = prevDeno;
  }
});
