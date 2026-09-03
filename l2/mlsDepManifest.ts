/// <mls fileReference="_102029_/l2/mlsDepManifest.ts" enhancement="_blank"/>

// Commitable build-CI manifest at the client project root (`mlsDep.json`).
// workspaceDependencies = l5/config.json workspaceDependencies ∪ masters.*.runtimeProject.
// One derivation; CB and CF both call it when they merge l5/config.json.

export interface MlsDepManifest {
  workspaceDependencies: string[];
}

export interface MlsDepWriteIo {
  read?(path: string): string;
  write(path: string, source: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function projectId(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim();
  return '';
}

/** Sorted unique ids: the l5/config.json list plus each master's runtimeProject. */
export function buildMlsDepWorkspaceIds(l5Config: unknown, l5Project: unknown): string[] {
  const ids = new Set<string>();
  const listed = isRecord(l5Config) ? l5Config.workspaceDependencies : undefined;
  if (Array.isArray(listed)) {
    for (const item of listed) {
      const id = projectId(item);
      if (id) ids.add(id);
    }
  }
  const masters = isRecord(l5Project) && isRecord(l5Project.masters) ? l5Project.masters : {};
  for (const side of ['frontend', 'backend'] as const) {
    const signature = isRecord(masters[side]) ? masters[side] : undefined;
    const id = projectId(signature?.runtimeProject);
    if (id) ids.add(id);
  }
  return [...ids].sort((left, right) => Number(left) - Number(right));
}

export function serializeMlsDepJson(ids: readonly string[]): string {
  const manifest: MlsDepManifest = { workspaceDependencies: [...ids] };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function mlsDepJsonContents(l5Config: unknown, l5Project: unknown): string {
  return serializeMlsDepJson(buildMlsDepWorkspaceIds(l5Config, l5Project));
}

export function mlsDepPathFromL5ConfigPath(configPath: string): string {
  return configPath.replace(/l5[/\\]config\.json$/i, 'mlsDep.json');
}

/** Byte-identical content is a no-op so a second merge does not dirty the worktree. */
export function emitMlsDepJson(
  destPath: string,
  l5Config: unknown,
  l5Project: unknown,
  io: MlsDepWriteIo,
): boolean {
  let existing: string | null = null;
  if (io.read) {
    try { existing = io.read(destPath); } catch { existing = null; }
  }
  const next = mlsDepJsonContents(l5Config, l5Project);
  if (existing === next) return false;
  io.write(destPath, next);
  return true;
}

/**
 * Host-only write of `<client>/mlsDep.json`. No-op in the browser (no diskPath / no write
 * capability). Branches on capability, not on host name.
 */
export function emitMlsDepJsonIfHostDisk(project: number, l5Config: unknown, l5Project: unknown): boolean {
  if (!project) return false;
  // `stor` is kept whole and `diskPath` is called AS A METHOD: on the CLI host it is a
  // class method over a private field, so a detached `const fn = …; fn(info)` throws,
  // the catch below swallows it and the manifest is never written — the VM build then
  // fails to resolve the closure (the 328-error run of 02/09). Measured 02/09.
  const stor = (globalThis as { mls?: { stor?: { diskPath?: (info: {
    project: number; level: number; folder: string; shortName: string; extension: string;
  }) => string } } }).mls?.stor;
  const diskPath = stor?.diskPath;
  const deno = (globalThis as {
    Deno?: { writeTextFileSync?: (path: string, data: string) => void; readTextFileSync?: (path: string) => string };
  }).Deno;
  if (typeof diskPath !== 'function' || typeof deno?.writeTextFileSync !== 'function') return false;
  let dest: string;
  try {
    dest = mlsDepPathFromL5ConfigPath(stor!.diskPath!({
      project, level: 5, folder: '', shortName: 'config', extension: '.json',
    }));
  } catch {
    return false;
  }
  return emitMlsDepJson(dest, l5Config, l5Project, {
    read: typeof deno.readTextFileSync === 'function' ? (path) => deno.readTextFileSync!(path) : undefined,
    write: (path, source) => deno.writeTextFileSync!(path, source),
  });
}
