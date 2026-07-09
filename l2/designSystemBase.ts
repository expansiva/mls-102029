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
// and (c) tests. New DS entries start from this; the AI only re-derives the color FAMILY bases
// from the brand palette and the render/plugin expands the rest.
//
// Naming convention (colors): `<family>-color[-lighter|-darker][-hover|-focus|-disabled]`
// (grey is special: `grey-color[-lighter|-light|-dark|-darker]`, no states). Dark values use the
// `_dark-<name>` key prefix. `global`/`typography` use Less expressions (`@token`) for scales.

/** The 11 color families (base key = `<family>-color`). `grey` has a distinct variant shape. */
export const MANDATORY_COLOR_FAMILIES = [
  'text-primary', 'text-secondary', 'bg-primary', 'bg-secondary', 'grey',
  'error', 'success', 'warning', 'info', 'active', 'link',
] as const;
export type MandatoryColorFamily = typeof MANDATORY_COLOR_FAMILIES[number];

/** Complete default DS tokens (light + `_dark-` pairs). The canonical mandatory baseline. */
export const DEFAULT_TOKENS_TEMPLATE: { color: IKeyValueToken; global: IKeyValueToken; typography: IKeyValueToken } = {
  color: {
    "text-primary-color-lighter": "#535353",
    "text-primary-color-lighter-hover": "#5f5f5f",
    "text-primary-color-lighter-focus": "#4a4a4a",
    "text-primary-color-lighter-disabled": "#696969",
    "text-primary-color": "#403f3f",
    "text-primary-color-hover": "#4b4a4a",
    "text-primary-color-focus": "#353434",
    "text-primary-color-disabled": "#525151",
    "text-primary-color-darker": "#000000",
    "text-primary-color-darker-hover": "#1a1a1a",
    "text-primary-color-darker-focus": "#0d0d0d",
    "text-primary-color-darker-disabled": "#262626",
    "text-secondary-color-lighter": "#408EC8",
    "text-secondary-color-lighter-hover": "#4a9adb",
    "text-secondary-color-lighter-focus": "#377bb0",
    "text-secondary-color-lighter-disabled": "#629fd2",
    "text-secondary-color": "#1C91CD",
    "text-secondary-color-hover": "#2a9edb",
    "text-secondary-color-focus": "#1786b7",
    "text-secondary-color-disabled": "#55b4e1",
    "text-secondary-color-darker": "#0F6FA9",
    "text-secondary-color-darker-hover": "#1b7bb5",
    "text-secondary-color-darker-focus": "#0c6495",
    "text-secondary-color-darker-disabled": "#3a9ec1",
    "bg-primary-color-lighter": "#ffffff",
    "bg-primary-color-lighter-hover": "#f2f2f2",
    "bg-primary-color-lighter-focus": "#e6e6e6",
    "bg-primary-color-lighter-disabled": "#d9d9d9",
    "bg-primary-color": "#ffffff",
    "bg-primary-color-hover": "#f2f2f2",
    "bg-primary-color-focus": "#e6e6e6",
    "bg-primary-color-disabled": "#d9d9d9",
    "bg-primary-color-darker": "#fafafa",
    "bg-primary-color-darker-hover": "#f5f5f5",
    "bg-primary-color-darker-focus": "#eeeeee",
    "bg-primary-color-darker-disabled": "#e0e0e0",
    "bg-secondary-color-lighter": "#F9F9F9",
    "bg-secondary-color-lighter-hover": "#f4f4f4",
    "bg-secondary-color-lighter-focus": "#efefef",
    "bg-secondary-color-lighter-disabled": "#eaeaea",
    "bg-secondary-color": "#E6E6E6",
    "bg-secondary-color-hover": "#d9d9d9",
    "bg-secondary-color-focus": "#cccccc",
    "bg-secondary-color-disabled": "#bfbfbf",
    "bg-secondary-color-darker": "#C0C0C0",
    "bg-secondary-color-darker-hover": "#b3b3b3",
    "bg-secondary-color-darker-focus": "#a6a6a6",
    "bg-secondary-color-darker-disabled": "#999999",
    "grey-color-lighter": "#F9FAFB",
    "grey-color-light": "#F2F2F2",
    "grey-color": "#E6E6E6",
    "grey-color-dark": "#D3D3D3",
    "grey-color-darker": "#C0C0C0",
    "error-color": "#FF4D4F",
    "error-color-hover": "#ff6666",
    "error-color-focus": "#e63e3e",
    "error-color-disabled": "#ff9999",
    "success-color": "#52C41A",
    "success-color-hover": "#66d93f",
    "success-color-focus": "#4ca610",
    "success-color-disabled": "#8cd78e",
    "warning-color": "#FAAD14",
    "warning-color-hover": "#fbbd34",
    "warning-color-focus": "#e09a0e",
    "warning-color-disabled": "#fdd55e",
    "info-color": "#0a6dc9",
    "info-color-hover": "#1b7edb",
    "info-color-focus": "#006ab3",
    "info-color-disabled": "#66a8e1",
    "active-color": "#1890FF",
    "active-color-hover": "#1a99ff",
    "active-color-focus": "#0e80cc",
    "active-color-disabled": "#66b3ff",
    "link-color": "#1890FF",
    "link-color-hover": "#1a99ff",
    "link-color-focus": "#0e80cc",
    "link-color-disabled": "#66b3ff",
    "_dark-text-primary-color-lighter": "#FFFFFF",
    "_dark-text-primary-color-lighter-hover": "#f2f2f2",
    "_dark-text-primary-color-lighter-focus": "#e6e6e6",
    "_dark-text-primary-color-lighter-disabled": "#d9d9d9",
    "_dark-text-primary-color": "#e6edf3",
    "_dark-text-primary-color-hover": "#d1d9e4",
    "_dark-text-primary-color-focus": "#c3cfd8",
    "_dark-text-primary-color-disabled": "#b0b8c4",
    "_dark-text-primary-color-darker": "#8d96a0",
    "_dark-text-primary-color-darker-hover": "#a1aab0",
    "_dark-text-primary-color-darker-focus": "#7a828a",
    "_dark-text-primary-color-darker-disabled": "#b1b7bd",
    "_dark-text-secondary-color-lighter": "#5294c7",
    "_dark-text-secondary-color-lighter-hover": "#63a2d8",
    "_dark-text-secondary-color-lighter-focus": "#4787b2",
    "_dark-text-secondary-color-lighter-disabled": "#78b0e0",
    "_dark-text-secondary-color": "#56a8d1",
    "_dark-text-secondary-color-hover": "#68b8e0",
    "_dark-text-secondary-color-focus": "#4b9cc4",
    "_dark-text-secondary-color-disabled": "#80c4e5",
    "_dark-text-secondary-color-darker": "#bddef3",
    "_dark-text-secondary-color-darker-hover": "#c7e3f5",
    "_dark-text-secondary-color-darker-focus": "#a3c8e5",
    "_dark-text-secondary-color-darker-disabled": "#d3e9f7",
    "_dark-bg-primary-color-lighter": "#666666",
    "_dark-bg-primary-color-lighter-hover": "#7a7a7a",
    "_dark-bg-primary-color-lighter-focus": "#5c5c5c",
    "_dark-bg-primary-color-lighter-disabled": "#808080",
    "_dark-bg-primary-color": "#0d1117",
    "_dark-bg-primary-color-hover": "#1a1f24",
    "_dark-bg-primary-color-focus": "#0a0e13",
    "_dark-bg-primary-color-disabled": "#2b3036",
    "_dark-bg-primary-color-darker": "#262626",
    "_dark-bg-primary-color-darker-hover": "#333333",
    "_dark-bg-primary-color-darker-focus": "#1f1f1f",
    "_dark-bg-primary-color-darker-disabled": "#404040",
    "_dark-bg-secondary-color-lighter": "#636363",
    "_dark-bg-secondary-color-lighter-hover": "#757575",
    "_dark-bg-secondary-color-lighter-focus": "#4e4e4e",
    "_dark-bg-secondary-color-lighter-disabled": "#808080",
    "_dark-bg-secondary-color": "#161b22",
    "_dark-bg-secondary-color-hover": "#1f2329",
    "_dark-bg-secondary-color-focus": "#0f1418",
    "_dark-bg-secondary-color-disabled": "#2c3238",
    "_dark-bg-secondary-color-darker": "#4b3f3f",
    "_dark-bg-secondary-color-darker-hover": "#5b4f4f",
    "_dark-bg-secondary-color-darker-focus": "#3f2f2f",
    "_dark-bg-secondary-color-darker-disabled": "#6a5c5c",
    "_dark-grey-color-lighter": "#2B2B2B",
    "_dark-grey-color-light": "#414141",
    "_dark-grey-color": "#575757",
    "_dark-grey-color-dark": "#6D6D6D",
    "_dark-grey-color-darker": "#969494",
    "_dark-error-color": "#f9676a",
    "_dark-error-color-hover": "#ff7b7f",
    "_dark-error-color-focus": "#e5565e",
    "_dark-error-color-disabled": "#ff9b9e",
    "_dark-success-color": "#63d42b",
    "_dark-success-color-hover": "#75d93d",
    "_dark-success-color-focus": "#55b825",
    "_dark-success-color-disabled": "#8ade5f",
    "_dark-warning-color": "#eead2b",
    "_dark-warning-color-hover": "#f2b73d",
    "_dark-warning-color-focus": "#d69c1f",
    "_dark-warning-color-disabled": "#f5cd5c",
    "_dark-info-color": "#0b81ef",
    "_dark-info-color-hover": "#1a95f6",
    "_dark-info-color-focus": "#0073d8",
    "_dark-info-color-disabled": "#66b3ef",
    "_dark-active-color": "#0b81ef",
    "_dark-active-color-hover": "#1a95f6",
    "_dark-active-color-focus": "#0073d8",
    "_dark-active-color-disabled": "#66b3ef",
    "_dark-link-color": "#0b81ef",
    "_dark-link-color-hover": "#1a95f6",
    "_dark-link-color-focus": "#0073d8",
    "_dark-link-color-disabled": "#66b3ef",
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