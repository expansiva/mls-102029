/// <mls fileReference="_102029_/l2/designSystemBase.ts" enhancement="_blank" />

export interface IKeyValueToken {
  [key: string]: string;
}

/** A custom @font-face entry (self-hosted / arbitrary URL). */
export interface DsFontFace {
  weight?: number;
  style?: string;
  src: string;
}

/**
 * One font ROLE. `name` is the role (display, body, mono, …).
 * `source` decides how the family is LOADED:
 *   - system: already installed (no load)
 *   - google: loaded via `@import` from Google Fonts (URL derived from family + weights)
 *   - custom: loaded from `url` (a stylesheet @import) or `faces` (@font-face blocks)
 */
export interface DsFont {
  name: string;
  source?: 'system' | 'google' | 'custom';
  family: string;
  weights?: number[];
  fallback?: string;                               // serif | sans-serif | monospace | …
  url?: string;                                    // custom: stylesheet URL to @import
  faces?: DsFontFace[];                            // custom: @font-face sources
}

/**
 * Molecule-token reconciliation for a DS entry: the `--ml-*` vocabulary of the used
 * molecule groups mapped to `--ds-*` expressions. Lives on the entry (same home as the
 * tokens) and is applied by the render into `:root` (see {@link tokensCssFromTheme}).
 *
 * Runtime-clean core interface — the reconciliation agent (`_102020_/l2/dsMatch`)
 * re-exports it so both sides share one shape.
 */
export interface DsTokenReconciliation {
  version: string;                        // `${dsTokensHash}/${mlVocabHash}` — staleness key
  usedGroups?: string[];                  // groups whose --ml-* were reconciled (accumulates)
  map: Record<string, string | null>;    // --ml-* → css expr (var(--ds-*)/derived); null = keep default
  pinned?: Record<string, string>;        // manual overrides — win over the agent, emitted last
}

export interface IDesignSystemTokens {
  themeName: string;
  description: string;
  color: IKeyValueToken;
  typography: IKeyValueToken;
  global: IKeyValueToken;
  /** Font roles that need LOADING (@import/@font-face). The family value itself still lives as a regular token (e.g. `typography['font-family-primary']`). */
  fonts?: DsFont[];
  /** Correlates this entry with the generation config bucket `designSystems[dsIndex]` in l5/project.json (and the `page<layout><ds>` folders). Falls back to the array position + 1 when absent. */
  dsIndex?: string;
  /** Molecule-token reconciliation (`--ml-*` → `--ds-*`), applied by the render into `:root`. */
  tokenReconciliation?: DsTokenReconciliation;
}

export interface IDesignSystem {
  tokens: IDesignSystemTokens[];
}

export interface IDarkLight {
  [theme: string]: IKeyValueToken
}

/**
 * Loads the project design system and compiles its tokens into ready-to-inject CSS:
 * font-loading rules (`@import`/`@font-face`, when the theme declares `fonts`) followed by
 * a `:root { --token: value; }` block and a `[data-theme="dark"], :root.dark` override block.
 *
 * Runs both in dev (editor/preview) and at app bootstrap in production.
 *
 * @param theme - Which theme to compile: a numeric index into the `tokens` array, or a string matched against `themeName`. Falls back to the first theme when omitted or not found.
 * @param path - Module path of the design system file, forwarded to {@link getTokens}. Defaults to the production convention `/designSystem.js`; dev callers should pass the preview path (e.g. `/_102048_/l2/designSystem.js`).
 * @returns The compiled CSS string, or an empty string when the project has no design system.
 * @throws When the design system exists but its tokens fail to compile.
 */
export async function getTokensCss(nameOrIndex?: number | string, path?: string): Promise<string> {
  let tokens: IDesignSystemTokens[] = [];

  try {
    tokens = await getTokens(path);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[getTokensCss] Project has no design system:', message);
    return '';
  }

  if (tokens.length === 0) return '';

  try {
    let tokenInfo = typeof nameOrIndex === 'string'
      ? tokens.find((item) => item.themeName === nameOrIndex)
      : tokens.find((item) => item.dsIndex === nameOrIndex?.toString())
    if (!tokenInfo) tokenInfo = tokens[0]; // If not defined theme, select first design system
    return tokensCssFromTheme(tokenInfo);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[getTokensCss] Error compiling tokens: ${message}`);
  }
}

/**
 * Compile ONE theme entry into ready-to-inject CSS: font-loading rules (`@import`/`@font-face`)
 * followed by the `:root` / `[data-theme="dark"], :root.dark` custom-property blocks. Pure
 * (no I/O) — the shared core of both the runtime {@link getTokensCss} and the editor variant
 * (`_102027_/l2/designSystemBase.getTokensCss`).
 *
 * @param tokenInfo - The theme entry (color + typography + global maps; dark via `_dark-` prefix; optional `fonts`; optional `tokenReconciliation`).
 * @returns The compiled CSS string.
 */
export function tokensCssFromTheme(tokenInfo: IDesignSystemTokens): string {
  const allTokens = {
    ...tokenInfo.color,
    ...tokenInfo.typography,
    ...tokenInfo.global
  };
  const themedTokens = getDarkAndLight(allTokens);
  const cssVars = getCssVars(themedTokens);
  const tokensCss = convertLessTokensToCss(cssVars, themedTokens.root);

  const fontLoads = getFontLoadsCss(tokenInfo.fonts);
  const mlTokensCss = getMlTokensCss(tokenInfo.tokenReconciliation);
  return [fontLoads, tokensCss, mlTokensCss].filter(Boolean).join('\n');
}

/**
 * Molecule-token reconciliation as a `:root` block: each `--ml-*` mapped to its `--ds-*`
 * expression (`map`, then `pinned` overrides which win). `null`/empty values are skipped —
 * the molecule keeps its own default. Theme-agnostic: the values point at `var(--ds-*)`,
 * which already switch in the dark block, so a single `:root` block covers both themes.
 *
 * @param reconciliation - The entry's `tokenReconciliation`; absent/empty yields an empty string.
 * @returns The `:root { --ml-*: …; }` block, or an empty string when nothing is mapped.
 */
export function getMlTokensCss(reconciliation?: DsTokenReconciliation): string {
  if (!reconciliation) return '';
  const final: Record<string, string | null> = { ...reconciliation.map, ...(reconciliation.pinned ?? {}) };
  const lines: string[] = [];
  for (const key of Object.keys(final).sort()) {
    const value = final[key];
    if (typeof value !== 'string' || !value.trim()) continue; // null/empty = keep the molecule default
    lines.push(`\t--${key.replace(/^--/, '')}: ${value.trim()};`);
  }
  return lines.length ? `:root{\n${lines.join('\n')}\n}` : '';
}

function googleImportUrl(family: string, weights?: number[]): string {
  const fam = family.trim().replace(/\s+/g, '+');
  const w = (weights && weights.length) ? `:wght@${[...weights].sort((a, b) => a - b).join(';')}` : '';
  return `https://fonts.googleapis.com/css2?family=${fam}${w}&display=swap`;
}

/**
 * Font-loading CSS for one theme: `@import` lines (google + custom URLs) and
 * `@font-face` blocks (custom self-hosted sources). Must come before every other
 * rule in the final stylesheet — `@import` is only valid at the top.
 *
 * @param fonts - The theme's `fonts` declarations; absent/empty yields an empty string.
 * @returns The font-loading CSS, or an empty string when there is nothing to load.
 */
export function getFontLoadsCss(fonts?: DsFont[]): string {
  if (!Array.isArray(fonts) || fonts.length === 0) return '';
  const imports = new Set<string>();
  const faces: string[] = [];
  for (const f of fonts) {
    if (!f || !f.family) continue;
    if (f.source === 'google') {
      imports.add(googleImportUrl(f.family, f.weights));
    } else if (f.source === 'custom') {
      if (f.url) imports.add(f.url);
      for (const face of f.faces ?? []) {
        if (!face?.src) continue;
        const parts = [`font-family: '${f.family}';`, `src: url('${face.src}') format('woff2');`];
        if (face.weight) parts.push(`font-weight: ${face.weight};`);
        if (face.style) parts.push(`font-style: ${face.style};`);
        faces.push(`@font-face { ${parts.join(' ')} }`);
      }
    }
    // system: nothing to load
  }
  return [...[...imports].map(u => `@import url('${u}');`), ...faces].join('\n');
}

/**
 * Dynamically imports the design system module and returns its raw token themes.
 *
 * Note: `import()` caches by URL — in dev, append a cache-busting query
 * (e.g. `?v=${Date.now()}`) to the path to reload after the design system changes.
 *
 * @param path - Module path of the design system file. Defaults to `/designSystem.js`, the path where the built app serves it in production.
 * @returns The design system's `tokens` array (one entry per theme), or an empty array when the module exports none.
 * @throws When the module cannot be imported or resolves to nothing.
 */
export async function getTokens(path: string = '/designSystem.js'): Promise<IDesignSystemTokens[]> {
  const designSystem: IDesignSystem = await import(path);
  if (!designSystem) throw new Error(`Invalid ds file: ${path}`);
  return designSystem.tokens || [];
}

/**
 * Strips every `//Start Less Tokens ... //End Less Tokens` block from a Less source,
 * so token definitions injected by the editor are not duplicated when recompiling.
 *
 * @param src - Less source that may contain injected token blocks.
 * @returns The source without the token blocks.
 */
export function removeTokensFromSource(src: string) {
  const regex = /\/\/Start Less Tokens[\s\S]*?\/\/End Less Tokens/g;
  return src.replace(regex, '');
}

/**
 * Splits a flat token map into theme groups by key prefix: keys starting with
 * `_dark-` go to the `dark` group, everything else goes to `root` (light/default).
 *
 * @param allTokens - Flat map with all tokens of a theme (color + typography + global merged).
 * @returns Tokens grouped by theme name (`root`, `dark`), keeping the original keys.
 */
export function getDarkAndLight(allTokens: IKeyValueToken): IDarkLight {
  const themes: IDarkLight = {};
  Object.entries(allTokens).forEach((entry) => {
    const [key, value] = entry;
    const [theme] = key.split('-');
    let themeName = 'root';
    if (theme === '_dark') themeName = 'dark';
    if (!themes[themeName]) themes[themeName] = {};
    themes[themeName][key] = value;
  });
  return themes;
}

/**
 * Renders theme groups as CSS custom-property blocks: the `root` group becomes
 * `:root { --token: value; }` and any other group becomes a
 * `[data-theme="dark"], :root.dark { ... }` block (both dark conventions — legacy
 * attribute and Aura class) with the theme prefix stripped from the keys.
 *
 * @param themes - Tokens grouped by theme, as produced by {@link getDarkAndLight}.
 * @returns The CSS blocks joined into a single string (values may still contain Less expressions — see {@link convertLessTokensToCss}).
 */
export function getCssVars(themes: IDarkLight) {
  const cssArr: string[] = [];
  Object.entries(themes).forEach((entry) => {
    const [key, value] = entry;
    if (key === 'root') {

      const cssVars: string[] = [];
      Object.entries(value).forEach((entryTokens) => {
        const [keyToken, valueToken] = entryTokens;
        const cssVar = `--${keyToken}: ${valueToken};`;
        cssVars.push(cssVar);
      });
      const cssFinal = `:root{\n\t${cssVars.join('\n\t')}\n}`;
      cssArr.push(cssFinal);

    } else {

      const cssVars: string[] = [];
      Object.entries(value).forEach((entryTokensDark) => {
        const [keyToken, valueToken] = entryTokensDark;
        const tokenKey = keyToken.substring(1 + key.length + 1, keyToken.length);
        const cssVar = `--${tokenKey}: ${valueToken};`;
        cssVars.push(cssVar);
      });
      const cssFinal = `[data-theme="dark"], :root.dark {\n\t${cssVars.join('\n\t')}\n}`;
      cssArr.push(cssFinal);
    }

  });

  return cssArr.join('\n');
}

// Less-only functions. Names that also exist as native CSS functions
// (min, max, round, mod, abs, sqrt, pow, contrast...) must NOT be listed:
// this output goes straight to the browser, so a token kept as @token
// inside them would become invalid CSS.
const lessOnlyFunctions = [
  "lighten", "darken", "saturate", "desaturate", "fadein", "fadeout", "fade",
  "spin", "mix", "tint", "shade", "ceil", "floor", "escape", "unit",
  "convert", "extract", "length"
];
const insideLessFunctionRegex = new RegExp(`\\b(${lessOnlyFunctions.join("|")})\\s*\\([^()]*$`, "i");

/**
 * Rewrites Less token references (`@token`) as CSS variable reads (`var(--token)`),
 * so the output can be served straight to the browser without a Less compile step.
 *
 * A reference is only rewritten when the token exists in `tokens`; occurrences
 * inside `@media (...)` conditions or inside Less-only function calls (see
 * `lessOnlyFunctions`) are left untouched, since `var()` is invalid there.
 *
 * @param less - Less source containing `@token` references.
 * @param tokens - Map of known token names used to validate each reference.
 * @returns The source with valid token references converted to `var(--token)`.
 */
export function convertLessTokensToCss(less: string, tokens: IKeyValueToken): string {

  if(!tokens) return '';

  const lessTokens = new Set(Object.keys(tokens));
  return less.replace(/@([a-zA-Z0-9-_]+)/g, (match, token, offset, fullText) => {
    if (!lessTokens.has(token)) {
      return match;
    }

    const beforeText = fullText.slice(0, offset);
    const insideMediaQuery = /@media\s*\([^{}]*$/.test(beforeText);
    const insideLessFunction = insideLessFunctionRegex.test(beforeText);
    if (insideMediaQuery || insideLessFunction) {
      return match;
    }

    return `var(--${token})`;
  });
}

// ─── Mandatory token standard (single source of truth) ───────────────────────
//
// The unified DS model has NO fixed `ds-*` prefix — token names are free-form. But a project's
// DS entry is expected to define a MANDATORY baseline so molecules/pages can rely on it. This
// template is that baseline: the canonical default values consumed by (a) the "generate DS with
// AI" agent (what to fill), (b) the Design System plugin (which rows are locked against deletion)
// and (c) tests. New DS entries start from this; the AI only re-derives the color ROLE bases
// from the brand palette and the render/plugin expands the states.
//
// Naming convention (colors) — BY ROLE: `<role>[-hover|-focus|-disabled]`. The name says WHERE
// the token is used; never infer it from the value. Pairs travel together: whoever paints with
// `<role>-bg` writes the label with `<role>-text` (button-primary, status-error, nav, tooltip…).
// Surfaces: `page-bg` (page) > `surface-bg` (cards, panels, modals) > `surface-alt-bg` (zebra
// rows, row hover, skeleton, section headers); text on them is `text-strong` (titles),
// `text-default` (body), `text-muted` (secondary/placeholder). Charts use `chart-series-1..6`
// ALWAYS in this fixed order (the order IS the colour-blindness safeguard — never shuffle, never
// invent a new series colour); axis/labels use the `text-*` tokens, and `status-*` is reserved
// for state and never becomes a series. Night mode: every key has a `_dark-<name>` twin.
// `global`/`typography` use Less expressions (`@token`) for scales.

/** The 44 color ROLES. Each role carries 4 keys: the base plus
 *  `-hover`, `-focus` and `-disabled` — and a `_dark-` twin for every one of them. */
export const MANDATORY_COLOR_ROLES = [
  'page-bg',
  'surface-bg',
  'surface-alt-bg',
  'input-bg',
  'text-strong',
  'text-default',
  'text-muted',
  'border-default',
  'border-subtle',
  'button-primary-bg',
  'button-primary-text',
  'button-secondary-bg',
  'button-secondary-text',
  'button-secondary-border',
  'button-danger-bg',
  'button-danger-text',
  'link-text',
  'focus-ring',
  'selected-bg',
  'selected-text',
  'selected-border',
  'status-success-bg',
  'status-success-text',
  'status-error-bg',
  'status-error-text',
  'status-warning-bg',
  'status-warning-text',
  'status-info-bg',
  'status-info-text',
  'status-neutral-bg',
  'status-neutral-text',
  'nav-bg',
  'nav-text',
  'nav-active-bg',
  'nav-active-text',
  'overlay-backdrop-bg',
  'tooltip-bg',
  'tooltip-text',
  'chart-series-1',
  'chart-series-2',
  'chart-series-3',
  'chart-series-4',
  'chart-series-5',
  'chart-series-6',
] as const;
export type MandatoryColorRole = typeof MANDATORY_COLOR_ROLES[number];

/** Complete default DS tokens (light + `_dark-` pairs). The canonical mandatory baseline. */
export const DEFAULT_TOKENS_TEMPLATE: { color: IKeyValueToken; global: IKeyValueToken; typography: IKeyValueToken } = {
  color: {
    "page-bg": "#eef1f5",
    "page-bg-hover": "#dde0e4",
    "page-bg-focus": "#cfd2d5",
    "page-bg-disabled": "#eef1f5",
    "surface-bg": "#ffffff",
    "surface-bg-hover": "#ededed",
    "surface-bg-focus": "#dedede",
    "surface-bg-disabled": "#f6f7fa",
    "surface-alt-bg": "#f5f7fa",
    "surface-alt-bg-hover": "#e4e6e8",
    "surface-alt-bg-focus": "#d5d7da",
    "surface-alt-bg-disabled": "#f1f4f7",
    "input-bg": "#ffffff",
    "input-bg-hover": "#ededed",
    "input-bg-focus": "#dedede",
    "input-bg-disabled": "#f6f7fa",
    "text-strong": "#111827",
    "text-strong-hover": "#101624",
    "text-strong-focus": "#0f1522",
    "text-strong-disabled": "#8b8f98",
    "text-default": "#2f3a48",
    "text-default-hover": "#2c3643",
    "text-default-focus": "#29323f",
    "text-default-disabled": "#989fa7",
    "text-muted": "#5d6b7e",
    "text-muted-hover": "#566475",
    "text-muted-focus": "#515d6e",
    "text-muted-disabled": "#adb5bf",
    "border-default": "#cfd8e3",
    "border-default-hover": "#c1c9d3",
    "border-default-focus": "#b4bcc5",
    "border-default-disabled": "#e0e6ed",
    "border-subtle": "#e4e9f0",
    "border-subtle-hover": "#d4d9df",
    "border-subtle-focus": "#c6cbd1",
    "border-subtle-disabled": "#eaedf3",
    "button-primary-bg": "#1273d4",
    "button-primary-bg-hover": "#116bc5",
    "button-primary-bg-focus": "#1064b8",
    "button-primary-bg-disabled": "#8bb8e6",
    "button-primary-text": "#ffffff",
    "button-primary-text-hover": "#ededed",
    "button-primary-text-focus": "#dedede",
    "button-primary-text-disabled": "#f6f7fa",
    "button-secondary-bg": "#ffffff",
    "button-secondary-bg-hover": "#ededed",
    "button-secondary-bg-focus": "#dedede",
    "button-secondary-bg-disabled": "#f6f7fa",
    "button-secondary-text": "#2f3a48",
    "button-secondary-text-hover": "#2c3643",
    "button-secondary-text-focus": "#29323f",
    "button-secondary-text-disabled": "#989fa7",
    "button-secondary-border": "#c3cedb",
    "button-secondary-border-hover": "#b5c0cc",
    "button-secondary-border-focus": "#aab3bf",
    "button-secondary-border-disabled": "#dbe1e9",
    "button-danger-bg": "#c92a2e",
    "button-danger-bg-hover": "#bb272b",
    "button-danger-bg-focus": "#af2528",
    "button-danger-bg-disabled": "#dd979b",
    "button-danger-text": "#ffffff",
    "button-danger-text-hover": "#ededed",
    "button-danger-text-focus": "#dedede",
    "button-danger-text-disabled": "#f6f7fa",
    "link-text": "#0f62b8",
    "link-text-hover": "#0e5bab",
    "link-text-focus": "#0d55a0",
    "link-text-disabled": "#8ab1da",
    "focus-ring": "#7ab8f5",
    "focus-ring-hover": "#71abe4",
    "focus-ring-focus": "#6aa0d5",
    "focus-ring-disabled": "#bad7f5",
    "selected-bg": "#e3f1ff",
    "selected-bg-hover": "#d3e0ed",
    "selected-bg-focus": "#c5d2de",
    "selected-bg-disabled": "#e9f1fa",
    "selected-text": "#0d5296",
    "selected-text-hover": "#0c4c8c",
    "selected-text-focus": "#0b4782",
    "selected-text-disabled": "#89a9ca",
    "selected-border": "#1273d4",
    "selected-border-hover": "#116bc5",
    "selected-border-focus": "#1064b8",
    "selected-border-disabled": "#8bb8e6",
    "status-success-bg": "#e2f5db",
    "status-success-bg-hover": "#d2e4cc",
    "status-success-bg-focus": "#c5d5bf",
    "status-success-bg-disabled": "#e9f3e9",
    "status-success-text": "#25640e",
    "status-success-text-hover": "#225d0d",
    "status-success-text-focus": "#20570c",
    "status-success-text-disabled": "#94b28d",
    "status-error-bg": "#fde8e9",
    "status-error-bg-hover": "#ebd8d9",
    "status-error-bg-focus": "#dccacb",
    "status-error-bg-disabled": "#f5edf0",
    "status-error-text": "#ab2328",
    "status-error-text-hover": "#9f2125",
    "status-error-text-focus": "#951e23",
    "status-error-text-disabled": "#d09499",
    "status-warning-bg": "#fcf2d7",
    "status-warning-bg-hover": "#eae1c8",
    "status-warning-bg-focus": "#dbd3bb",
    "status-warning-bg-disabled": "#f4f1e8",
    "status-warning-text": "#775700",
    "status-warning-text-hover": "#6f5100",
    "status-warning-text-focus": "#684c00",
    "status-warning-text-disabled": "#b8ac87",
    "status-info-bg": "#e2effc",
    "status-info-bg-hover": "#d2deea",
    "status-info-bg-focus": "#c5d0db",
    "status-info-bg-disabled": "#e9f0f8",
    "status-info-text": "#0b5497",
    "status-info-text-hover": "#0a4e8c",
    "status-info-text-focus": "#0a4983",
    "status-info-text-disabled": "#88aacb",
    "status-neutral-bg": "#e9edf2",
    "status-neutral-bg-hover": "#d9dce1",
    "status-neutral-bg-focus": "#cbced3",
    "status-neutral-bg-disabled": "#eceff4",
    "status-neutral-text": "#46535f",
    "status-neutral-text-hover": "#414d58",
    "status-neutral-text-focus": "#3d4853",
    "status-neutral-text-disabled": "#a2aab2",
    "nav-bg": "#1c2430",
    "nav-bg-hover": "#1a212d",
    "nav-bg-focus": "#181f2a",
    "nav-bg-disabled": "#90959c",
    "nav-text": "#c9d3df",
    "nav-text-hover": "#bbc4cf",
    "nav-text-focus": "#afb8c2",
    "nav-text-disabled": "#dde4eb",
    "nav-active-bg": "#2e3d52",
    "nav-active-bg-hover": "#2b394c",
    "nav-active-bg-focus": "#283547",
    "nav-active-bg-disabled": "#98a0ac",
    "nav-active-text": "#ffffff",
    "nav-active-text-hover": "#ededed",
    "nav-active-text-focus": "#dedede",
    "nav-active-text-disabled": "#f6f7fa",
    "overlay-backdrop-bg": "rgba(9, 14, 20, 0.55)",
    "overlay-backdrop-bg-hover": "rgba(9, 14, 20, 0.55)",
    "overlay-backdrop-bg-focus": "rgba(9, 14, 20, 0.55)",
    "overlay-backdrop-bg-disabled": "rgba(9, 14, 20, 0.55)",
    "tooltip-bg": "#1c2430",
    "tooltip-bg-hover": "#1a212d",
    "tooltip-bg-focus": "#181f2a",
    "tooltip-bg-disabled": "#90959c",
    "tooltip-text": "#f0f4f8",
    "tooltip-text-hover": "#dfe3e7",
    "tooltip-text-focus": "#d1d4d8",
    "tooltip-text-disabled": "#eff2f6",
    "chart-series-1": "#2a78d6",
    "chart-series-1-hover": "#2770c7",
    "chart-series-1-focus": "#2568ba",
    "chart-series-1-disabled": "#96bbe7",
    "chart-series-2": "#1baf7a",
    "chart-series-2-hover": "#19a371",
    "chart-series-2-focus": "#17986a",
    "chart-series-2-disabled": "#8fd3be",
    "chart-series-3": "#eda100",
    "chart-series-3-hover": "#dc9600",
    "chart-series-3-focus": "#ce8c00",
    "chart-series-3-disabled": "#eecd87",
    "chart-series-4": "#008300",
    "chart-series-4-hover": "#007a00",
    "chart-series-4-focus": "#007200",
    "chart-series-4-disabled": "#83c087",
    "chart-series-5": "#4a3aa7",
    "chart-series-5-hover": "#45369b",
    "chart-series-5-focus": "#403291",
    "chart-series-5-disabled": "#a49fd2",
    "chart-series-6": "#e34948",
    "chart-series-6-hover": "#d34443",
    "chart-series-6-focus": "#c5403f",
    "chart-series-6-disabled": "#e9a5a7",
    "_dark-page-bg": "#0d1117",
    "_dark-page-bg-hover": "#1e2227",
    "_dark-page-bg-focus": "#2c3035",
    "_dark-page-bg-disabled": "#0d1117",
    "_dark-surface-bg": "#161b22",
    "_dark-surface-bg-hover": "#262b31",
    "_dark-surface-bg-focus": "#34393f",
    "_dark-surface-bg-disabled": "#11161c",
    "_dark-surface-alt-bg": "#1e2530",
    "_dark-surface-alt-bg-hover": "#2e343e",
    "_dark-surface-alt-bg-focus": "#3b414b",
    "_dark-surface-alt-bg-disabled": "#151a22",
    "_dark-input-bg": "#10151c",
    "_dark-input-bg-hover": "#21252c",
    "_dark-input-bg-focus": "#2f333a",
    "_dark-input-bg-disabled": "#0e1319",
    "_dark-text-strong": "#f0f4f8",
    "_dark-text-strong-hover": "#f1f5f8",
    "_dark-text-strong-focus": "#f2f5f9",
    "_dark-text-strong-disabled": "#73777c",
    "_dark-text-default": "#d7dee6",
    "_dark-text-default-hover": "#dae0e8",
    "_dark-text-default-focus": "#dce2e9",
    "_dark-text-default-disabled": "#686d74",
    "_dark-text-muted": "#96a3b3",
    "_dark-text-muted-hover": "#9da9b8",
    "_dark-text-muted-focus": "#a4afbd",
    "_dark-text-muted-disabled": "#4b535d",
    "_dark-border-default": "#3a4351",
    "_dark-border-default-hover": "#48505d",
    "_dark-border-default-focus": "#545b68",
    "_dark-border-default-disabled": "#212831",
    "_dark-border-subtle": "#262e3a",
    "_dark-border-subtle-hover": "#353d48",
    "_dark-border-subtle-focus": "#424954",
    "_dark-border-subtle-disabled": "#181e27",
    "_dark-button-primary-bg": "#3b96f0",
    "_dark-button-primary-bg-hover": "#499df1",
    "_dark-button-primary-bg-focus": "#54a4f2",
    "_dark-button-primary-bg-disabled": "#224d79",
    "_dark-button-primary-text": "#06121f",
    "_dark-button-primary-text-hover": "#17232f",
    "_dark-button-primary-text-focus": "#26313c",
    "_dark-button-primary-text-disabled": "#0a111b",
    "_dark-button-secondary-bg": "#1e2530",
    "_dark-button-secondary-bg-hover": "#2e343e",
    "_dark-button-secondary-bg-focus": "#3b414b",
    "_dark-button-secondary-bg-disabled": "#151a22",
    "_dark-button-secondary-text": "#d7dee6",
    "_dark-button-secondary-text-hover": "#dae0e8",
    "_dark-button-secondary-text-focus": "#dce2e9",
    "_dark-button-secondary-text-disabled": "#686d74",
    "_dark-button-secondary-border": "#3a4351",
    "_dark-button-secondary-border-hover": "#48505d",
    "_dark-button-secondary-border-focus": "#545b68",
    "_dark-button-secondary-border-disabled": "#212831",
    "_dark-button-danger-bg": "#e2555a",
    "_dark-button-danger-bg-hover": "#e46166",
    "_dark-button-danger-bg-focus": "#e66b6f",
    "_dark-button-danger-bg-disabled": "#6d3035",
    "_dark-button-danger-text": "#1f0708",
    "_dark-button-danger-text-hover": "#2f1819",
    "_dark-button-danger-text-focus": "#3c2728",
    "_dark-button-danger-text-disabled": "#150c10",
    "_dark-link-text": "#6cb2f7",
    "_dark-link-text-hover": "#76b7f8",
    "_dark-link-text-focus": "#7fbcf8",
    "_dark-link-text-disabled": "#38597c",
    "_dark-focus-ring": "#58a6ff",
    "_dark-focus-ring-hover": "#64acff",
    "_dark-focus-ring-focus": "#6eb2ff",
    "_dark-focus-ring-disabled": "#2f547f",
    "_dark-selected-bg": "#123351",
    "_dark-selected-bg-hover": "#23415d",
    "_dark-selected-bg-focus": "#314e68",
    "_dark-selected-bg-disabled": "#0f2031",
    "_dark-selected-text": "#8ec4f8",
    "_dark-selected-text-hover": "#96c8f8",
    "_dark-selected-text-focus": "#9dccf9",
    "_dark-selected-text-disabled": "#47627c",
    "_dark-selected-border": "#3b96f0",
    "_dark-selected-border-hover": "#499df1",
    "_dark-selected-border-focus": "#54a4f2",
    "_dark-selected-border-disabled": "#224d79",
    "_dark-status-success-bg": "#1c3617",
    "_dark-status-success-bg-hover": "#2c4427",
    "_dark-status-success-bg-focus": "#3a5035",
    "_dark-status-success-bg-disabled": "#142217",
    "_dark-status-success-text": "#8ade5f",
    "_dark-status-success-text-hover": "#92e06a",
    "_dark-status-success-text-focus": "#99e274",
    "_dark-status-success-text-disabled": "#456d37",
    "_dark-status-error-bg": "#40191b",
    "_dark-status-error-bg-hover": "#4d292b",
    "_dark-status-error-bg-focus": "#593739",
    "_dark-status-error-bg-disabled": "#241519",
    "_dark-status-error-text": "#ff8a8e",
    "_dark-status-error-text-hover": "#ff9296",
    "_dark-status-error-text-focus": "#ff999d",
    "_dark-status-error-text-disabled": "#7a474d",
    "_dark-status-warning-bg": "#3d3213",
    "_dark-status-warning-bg-hover": "#4b4024",
    "_dark-status-warning-bg-focus": "#564d32",
    "_dark-status-warning-bg-disabled": "#232015",
    "_dark-status-warning-text": "#e8c352",
    "_dark-status-warning-text-hover": "#eac75e",
    "_dark-status-warning-text-focus": "#ebcb68",
    "_dark-status-warning-text-disabled": "#706132",
    "_dark-status-info-bg": "#14304d",
    "_dark-status-info-bg-hover": "#243e59",
    "_dark-status-info-bg-focus": "#334b64",
    "_dark-status-info-bg-disabled": "#101f2f",
    "_dark-status-info-text": "#79b8f5",
    "_dark-status-info-text-hover": "#82bdf6",
    "_dark-status-info-text-focus": "#8ac1f6",
    "_dark-status-info-text-disabled": "#3e5c7b",
    "_dark-status-neutral-bg": "#2a323d",
    "_dark-status-neutral-bg-hover": "#39404b",
    "_dark-status-neutral-bg-focus": "#464d56",
    "_dark-status-neutral-bg-disabled": "#1a2028",
    "_dark-status-neutral-text": "#b0bcc9",
    "_dark-status-neutral-text-hover": "#b6c1cd",
    "_dark-status-neutral-text-focus": "#bac5d0",
    "_dark-status-neutral-text-disabled": "#565e67",
    "_dark-nav-bg": "#10151c",
    "_dark-nav-bg-hover": "#21252c",
    "_dark-nav-bg-focus": "#2f333a",
    "_dark-nav-bg-disabled": "#0e1319",
    "_dark-nav-text": "#96a3b3",
    "_dark-nav-text-hover": "#9da9b8",
    "_dark-nav-text-focus": "#a4afbd",
    "_dark-nav-text-disabled": "#4b535d",
    "_dark-nav-active-bg": "#123351",
    "_dark-nav-active-bg-hover": "#23415d",
    "_dark-nav-active-bg-focus": "#314e68",
    "_dark-nav-active-bg-disabled": "#0f2031",
    "_dark-nav-active-text": "#8ec4f8",
    "_dark-nav-active-text-hover": "#96c8f8",
    "_dark-nav-active-text-focus": "#9dccf9",
    "_dark-nav-active-text-disabled": "#47627c",
    "_dark-overlay-backdrop-bg": "rgba(0, 0, 0, 0.65)",
    "_dark-overlay-backdrop-bg-hover": "rgba(0, 0, 0, 0.65)",
    "_dark-overlay-backdrop-bg-focus": "rgba(0, 0, 0, 0.65)",
    "_dark-overlay-backdrop-bg-disabled": "rgba(0, 0, 0, 0.65)",
    "_dark-tooltip-bg": "#2a323d",
    "_dark-tooltip-bg-hover": "#39404b",
    "_dark-tooltip-bg-focus": "#464d56",
    "_dark-tooltip-bg-disabled": "#1a2028",
    "_dark-tooltip-text": "#f0f4f8",
    "_dark-tooltip-text-hover": "#f1f5f8",
    "_dark-tooltip-text-focus": "#f2f5f9",
    "_dark-tooltip-text-disabled": "#73777c",
    "_dark-chart-series-1": "#3987e5",
    "_dark-chart-series-1-hover": "#478fe7",
    "_dark-chart-series-1-focus": "#5397e8",
    "_dark-chart-series-1-disabled": "#214674",
    "_dark-chart-series-2": "#199e70",
    "_dark-chart-series-2-hover": "#29a57a",
    "_dark-chart-series-2-focus": "#37ab83",
    "_dark-chart-series-2-disabled": "#12503f",
    "_dark-chart-series-3": "#c98500",
    "_dark-chart-series-3-hover": "#cd8e12",
    "_dark-chart-series-3-focus": "#d09521",
    "_dark-chart-series-3-disabled": "#62450d",
    "_dark-chart-series-4": "#008300",
    "_dark-chart-series-4-hover": "#128c12",
    "_dark-chart-series-4-focus": "#219321",
    "_dark-chart-series-4-disabled": "#07440d",
    "_dark-chart-series-5": "#9085e9",
    "_dark-chart-series-5-hover": "#988eeb",
    "_dark-chart-series-5-focus": "#9e95ec",
    "_dark-chart-series-5-disabled": "#484575",
    "_dark-chart-series-6": "#e66767",
    "_dark-chart-series-6-hover": "#e87272",
    "_dark-chart-series-6-focus": "#e97b7b",
    "_dark-chart-series-6-disabled": "#6f383b",
  },
  global: {
    "breakpoint-small": "544px",
    "breakpoint-medium": "768px",
    "breakpoint-large": "1012px",
    "transition-slow": "0.2s",
    "transition-normal": "0.3s",
    "transition-fast": "0.5s",
    "space-base-unit": "0.25rem",
    "space-8": "calc(@space-base-unit * 2)",
    "space-16": "calc(@space-base-unit * 4)",
    "space-24": "calc(@space-base-unit * 6)",
    "space-32": "calc(@space-base-unit * 8)",
    "space-40": "calc(@space-base-unit * 10)",
    "space-48": "calc(@space-base-unit * 12)",
    "space-64": "calc(@space-base-unit * 16)",
    "radius-small": "6px",
    "radius-medium": "10px",
    "radius-large": "14px",
    "radius-pill": "999px",
    "shadow-small": "0 1px 2px rgba(15, 23, 42, 0.06)",
    "shadow-medium": "0 4px 12px rgba(15, 23, 42, 0.10)",
  },
  typography: {
    "font-base-unit": ".25rem",
    "font-family-primary": "'Charlie Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    "font-family-secondary": "serif",
    "font-size-12": "calc(@font-base-unit * 3)",
    "font-size-16": "calc(@font-base-unit * 4)",
    "font-size-20": "calc(@font-base-unit * 5)",
    "font-size-24": "calc(@font-base-unit * 6)",
    "font-size-40": "calc(@font-base-unit * 10)",
    "font-size-48": "calc(@font-base-unit * 12)",
    "font-size-64": "calc(@font-base-unit * 16)",
    "line-height-base-unit": "1",
    "line-height-small": "calc(@line-height-base-unit * 1.1)",
    "line-height-medium": "calc(@line-height-base-unit * 1.3)",
    "line-height-large": "calc(@line-height-base-unit * 1.5)",
    "font-weight-lighter": "100",
    "font-weight-light": "200",
    "font-weight-normal": "400",
    "font-weight-bold": "700",
    "font-weight-bolder": "900",
  },
};

/** The mandatory token names per section (derived from the template — the lock/completeness list). */
export const MANDATORY_TOKEN_KEYS: { color: string[]; global: string[]; typography: string[] } = {
  color: Object.keys(DEFAULT_TOKENS_TEMPLATE.color),
  global: Object.keys(DEFAULT_TOKENS_TEMPLATE.global),
  typography: Object.keys(DEFAULT_TOKENS_TEMPLATE.typography),
};

const MANDATORY_SETS = {
  color: new Set(MANDATORY_TOKEN_KEYS.color),
  global: new Set(MANDATORY_TOKEN_KEYS.global),
  typography: new Set(MANDATORY_TOKEN_KEYS.typography),
};

/** True when `key` is a mandatory (non-deletable) token of `section`. */
export function isMandatoryToken(section: 'color' | 'global' | 'typography', key: string): boolean {
  return MANDATORY_SETS[section]?.has(key) ?? false;
}

/** A fresh deep copy of the default template (never hand out the shared constant for mutation). */
export function defaultTokensTemplate(): { color: IKeyValueToken; global: IKeyValueToken; typography: IKeyValueToken } {
  return {
    color: { ...DEFAULT_TOKENS_TEMPLATE.color },
    global: { ...DEFAULT_TOKENS_TEMPLATE.global },
    typography: { ...DEFAULT_TOKENS_TEMPLATE.typography },
  };
}