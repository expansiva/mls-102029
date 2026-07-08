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
export async function getTokensCss(theme?: number | string, path?: string): Promise<string> {
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
    let tokenInfo = typeof theme === 'string'
      ? tokens.find((item) => item.themeName === theme)
      : tokens[theme || 0];
    if (!tokenInfo) tokenInfo = tokens[0]; // If not defined theme, select first design system

    const allTokens = {
      ...tokenInfo.color,
      ...tokenInfo.typography,
      ...tokenInfo.global
    };

    const themedTokens = getDarkAndLight(allTokens);
    const cssVars = getCssVars(themedTokens);
    const tokensCss = convertLessTokensToCss(cssVars, themedTokens.root);

    const fontLoads = getFontLoadsCss(tokenInfo.fonts);
    return fontLoads ? `${fontLoads}\n${tokensCss}` : tokensCss;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[getTokensCss] Error compiling tokens: ${message}`);
  }
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