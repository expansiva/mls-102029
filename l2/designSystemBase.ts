/// <mls fileReference="_102029_/l2/designSystemBase.ts" enhancement="_blank" />

export interface IKeyValueToken {
  [key: string]: string;
}

export interface IDesignSystemTokens {
  themeName: string;
  description: string;
  color: IKeyValueToken;
  typography: IKeyValueToken;
  global: IKeyValueToken;
}

export interface IDesignSystem {
  tokens: IDesignSystemTokens[];
}

export interface IDarkLight {
  [theme: string]: IKeyValueToken
}

export async function getTokensCss(index?: number): Promise<string> {
  let tokens: IDesignSystemTokens[] = [];

  try {
    tokens = await getTokens();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[getTokensCss] Project has no design system:', message);
    return '';
  }

  if (tokens.length === 0) return '';

  try {
    const prefix = ':root';

    let tokenInfo = tokens[index || 0];
    if (!tokenInfo) tokenInfo = tokens[0]; // If not defined theme, select first design system

    const allTokens = {
      ...tokenInfo.color,
      ...tokenInfo.typography,
      ...tokenInfo.global
    };

    const themedTokens = getDarkAndLight(allTokens);
    const cssVars = getCssVars(themedTokens, prefix);
    const tokensCss = convertLessTokensToCss(cssVars, themedTokens.root);

    return tokensCss;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[getTokensCss] Error compiling tokens: ${message}`);
  }
}

export async function getTokens(): Promise<IDesignSystemTokens[]> {
  const fileName = `/designSystem.js`;
  const designSystem: IDesignSystem = await import(fileName);
  if (!designSystem) throw new Error(`Invalid ds file: ${fileName}`);
  return designSystem.tokens || [];
}

export function removeTokensFromSource(src: string) {
  const regex = /\/\/Start Less Tokens[\s\S]*?\/\/End Less Tokens/g;
  return src.replace(regex, '');
}

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

export function getCssVars(themes: IDarkLight, prefix: ':host' | ':root') {
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
      const cssFinal = `${prefix}{\n\t${cssVars.join('\n\t')}\n}`;
      cssArr.push(cssFinal);

    } else {

      const cssVars: string[] = [];
      Object.entries(value).forEach((entryTokensDark) => {
        const [keyToken, valueToken] = entryTokensDark;
        const tokenKey = keyToken.substring(1 + key.length + 1, keyToken.length);
        const cssVar = `--${tokenKey}: ${valueToken};`;
        cssVars.push(cssVar);
      });
      const cssFinal = `[data-theme="dark"] {\n\t${cssVars.join('\n\t')}\n}`;
      cssArr.push(cssFinal);
    }

  });

  return cssArr.join('\n');
}

export function convertLessTokensToCss(less: string, tokens: IKeyValueToken): string {

  const lessTokens = new Set(Object.keys(tokens));
  return less.replace(/@([a-zA-Z0-9-_]+)/g, (match, token, offset, fullText) => {
    if (!lessTokens.has(token)) {
      return match;
    }

    const beforeText = fullText.slice(0, offset);
    const insideMediaQuery = /@media\s*\([^{}]*$/.test(beforeText);
    const lessFunctions = [
      "lighten", "darken", "saturate", "desaturate", "fadein", "fadeout", "fade",
      "spin", "mix", "tint", "shade", "contrast", "ceil", "floor", "round", "abs",
      "sqrt", "pow", "mod", "min", "max", "escape", "e", "unit", "convert",
      "extract", "length"
    ];

    const insideLessFunction = new RegExp(`(${lessFunctions.join("|")})\\s*\\([^()]*$`, "i").test(beforeText);
    if (insideMediaQuery || insideLessFunction) {
      return match;
    }

    return `var(--${token})`;
  });
}