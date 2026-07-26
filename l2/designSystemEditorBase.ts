/// <mls fileReference="_102029_/l2/designSystemEditorBase.ts" enhancement="_blank" />

import { collabImport } from '/_102029_/l2/collabImport.js';
// Pure design-system core lives in designSystemBase; the editor imports it
// (never the reverse) and adds only its editor-specific functions below.
import {
    getDarkAndLight, convertLessTokensToCss, tokensCssFromTheme, removeTokensFromSource,
    type IDesignSystemTokens, type IDesignSystem,
} from '/_102029_/l2/designSystemBase.js';
// Re-export the pieces existing importers of THIS module still reach for (single definitions
// now live in _102029_): the tokens interface + the marker-block stripper.
export { removeTokensFromSource, type IDesignSystemTokens };

export async function getTokens(project: number): Promise<IDesignSystemTokens[]> {
    const fileName = `./_${project}_designSystem`;
    const instance: IDesignSystem = await collabImport({ folder: '', project, shortName: 'designSystem' });
    if (!instance) throw new Error(`Invalid ds file: ${fileName}`);
    return instance.tokens || [];
}

export async function getTokensLess(project: number, theme: string): Promise<string> {
    try {
        const tokens = await getTokens(project)
        const tokenByTheme = tokens.find((item) => item.themeName === theme);
        if (!tokenByTheme) throw new Error(`no find theme: ${theme}`);
        let tokensLess = '';
        tokensLess += Object.keys(tokenByTheme.color).map((key) => {
            let token = '';
            if (!key.startsWith('_dark-')) token = `@${key}: ${tokenByTheme.color[key]};`
            return token;
        }).filter((item) => !!item).join('\n')
        tokensLess += '\n' + Object.keys(tokenByTheme.typography).map((key) => `@${key}: ${tokenByTheme.typography[key]};`).join('\n');
        tokensLess += '\n' + Object.keys(tokenByTheme.global).map((key) => `@${key}: ${tokenByTheme.global[key]};`).join('\n');
        return Promise.resolve(tokensLess);
    } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[getTokensLess] No design system file:', message);
        return ''
    }

}

export async function getTokensLessByTokensArray(tokens: IDesignSystemTokens[], theme: string): Promise<string> {

    const tokenByTheme = tokens.find((item) => item.themeName === theme);
    if (!tokenByTheme) throw new Error(`no find theme: ${theme}`);
    let tokensLess = '';
    tokensLess += Object.keys(tokenByTheme.color).map((key) => {
        let token = '';
        if (!key.startsWith('_dark-')) token = `@${key}: ${tokenByTheme.color[key]};`
        return token;
    }).filter((item) => !!item).join('\n')
    tokensLess += '\n' + Object.keys(tokenByTheme.typography).map((key) => `@${key}: ${tokenByTheme.typography[key]};`).join('\n');
    tokensLess += '\n' + Object.keys(tokenByTheme.global).map((key) => `@${key}: ${tokenByTheme.global[key]};`).join('\n');
    return Promise.resolve(tokensLess);
}


export async function getTokensCss(project: number, theme: string): Promise<string> {
    let tokens: IDesignSystemTokens[] = [];

    try {
        tokens = await getTokens(project);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[getTokensCss] Project has no design system:', message);
        return '';
    }

    try {
        const tokenInfo = tokens.find(item => item.themeName === theme);
        if (!tokenInfo) return '';
        return tokensCssFromTheme(tokenInfo); // shared pipeline (:root + [data-theme="dark"], :root.dark + font loads)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`[getTokensCss] Error compiling tokens: ${message}`);
    }
}

export async function getGlobalCss(project: number, theme: string): Promise<string> {
    let less = await getGlobalLess(project);
    less = less.replace(/project-\d+\s*{([\s\S]*)}$/m, "$1");
    const compiled = await preCompileLess(project, less, theme);
    return compiled;
}

export async function getGlobalLess(project: number): Promise<string> {

    const shortName = 'project';
    const folder = '';
    const key = mls.stor.getKeyToFiles(project, 2, shortName, folder, '.less');
    const storFile = mls.stor.files[key];
    if (!storFile) return '';
    let less = await storFile.getContent();
    if (!less || typeof less !== 'string') return '';
    return less;

}
export async function compileLess(str: string): Promise<string> {

    return new Promise((resolve, reject) => {
        if (!str || str.trim().length < 1) resolve('');
        mls.l2.less.compile(str).then(async (css) => {
            resolve(css);
        }).catch((err) => {
            reject(new Error('Error LESS: ' + err));
        });
    });
}

export async function preCompileLess(project: number, less: string, theme: string): Promise<string> {
    let tokens: IDesignSystemTokens[] = [];
    let tokensLess: string = '';

    try {
        tokens = await getTokens(project);
        tokensLess = await getTokensLess(project, theme);

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[preCompileLess] Project has no design system:', message);
        return '';
    }

    try {
        less = removeTokensFromSource(less);
        const tokenInfo = tokens.find((item) => item.themeName === theme);
        if (!tokenInfo) return '';
        const allTokens = { ...tokenInfo.color, ...tokenInfo.typography, ...tokenInfo.global };
        const darkAndLight = getDarkAndLight(allTokens);
        const newLess = convertLessTokensToCss(less, darkAndLight['root']);
        const res = await compileLess(`${newLess}\n${tokensLess}`)
        return res;
    } catch (err: any) {
        throw new Error(`Error on pre compile tokens Less: ${err.message}`);
    }

}

export async function preCompileLessAction(
    lessSource: string,
    tokens: IDesignSystemTokens[],
    theme: string
): Promise<string> {

    try {

        lessSource = removeTokensFromSource(lessSource);

        const tokenInfo = tokens.find((item) => item.themeName === theme);
        if (!tokenInfo) return '';

        const allTokens = {
            ...tokenInfo.color,
            ...tokenInfo.typography,
            ...tokenInfo.global
        };

        const darkAndLight = getDarkAndLight(allTokens);
        const newLess = convertLessTokensToCss(lessSource, darkAndLight['root']);
        const tokensLess = await getTokensLessByTokensArray(tokens, theme);

        const finalSource = `${newLess}\n${tokensLess}`;

        let lessEngine: any;

        //  Browser
        if (typeof window !== 'undefined' && (window as any).less) {
            lessEngine = (window as any).less;
        }
        //  Node (CommonJS ou ESM)
        else {
            const url = 'less';
            const lessModule = await import(url);
            lessEngine = lessModule.default || lessModule;
        }

        const res = await lessEngine.render(finalSource, {
            compress: false,
            filename: 'input.less'
        });

        return res.css;

    } catch (err: any) {
        throw new Error(`Error on pre compile tokens Less: ${err.message}`);
    }
}

export async function preCompileLessByThemeOrDefault(project: number, less: string, theme: string): Promise<string> {

    const tokens = await getTokens(project);
    const prefix = ':root';

    try {

        less = removeTokensFromSource(less);
        let tokenInfo = tokens.find((item) => item.themeName === theme);
        if (!tokenInfo) {
            tokenInfo = tokens.find((item) => item.themeName === 'Default');
            theme = 'Default';
        }
        if (!tokenInfo) throw new Error(`Not found tokens`);
        const allTokens = { ...tokenInfo.color, ...tokenInfo.typography, ...tokenInfo.global };
        const darkAndLight = getDarkAndLight(allTokens);
        const newLess = convertLessTokensToCss(less, darkAndLight['root']);
        const tokensLess = await getTokensLess(project, theme);
        const res = await compileLess(`${newLess}\n${tokensLess}`)
        return res;
    } catch (err: any) {
        throw new Error(`Error on pre compile tokens Less: ${err.message}`);
    }

}

export async function removeTokensTheme(project: number, themeName: string): Promise<void> {
    const actualTokens = await getTokens(project);
    const themeIndex = actualTokens.findIndex((theme) => theme.themeName === themeName);
    if (themeIndex === -1) return;
    actualTokens.splice(themeIndex, 1);
    await serializeTokens(project, actualTokens);
}

async function serializeTokens(project: number, tokens: IDesignSystemTokens[]) {
    const content = tokens.map(t => JSON.stringify(t, null, 4)).join(",\n\n");
    const key = mls.stor.getKeyToFiles(project, 2, 'designSystem', '', '.ts');
    const storFile = mls.stor.files[key];
    if (!storFile) return;

    const libCommon = await import('/_102029_/l2/libCommom.js');
    await libCommon.forceServiceInstance(2, '_100554_serviceSource');

    const serviceSource = mls.services['100554_serviceSource_left'];
    if (!serviceSource) throw new Error('Service source is not instancied');

    const libModel = await import('/_102029_/l2/libModel.js');
    const models = await libModel.createAllModels(storFile);
    if (!models || !models.ts) throw new Error(`Invalid models for file: ${project}_designSystem`);
    const newCode = dedupeHeader(replaceTokensBlock(models.ts.model.getValue(), `\n${content}\n`));
    serviceSource.setValueInModeKeepingUndo(models.ts.model, newCode, true);
}

/** Self-heal: keep only the FIRST `/// <mls …>` file-reference line, drop any duplicates. */
function dedupeHeader(code: string): string {
    let seen = false;
    return code.split('\n').filter(line => {
        if (/^\s*\/\/\/\s*<mls\s/.test(line)) {
            if (seen) return false;
            seen = true;
        }
        return true;
    }).join('\n');
}

export function replaceTokensBlock(code: string, newContent: string): string {
    // Greedy to the LAST `]` (the tokens array is the file's final statement). A lazy `[\s\S]*?`
    // stops at the FIRST `]`, which now appears INSIDE the entries (tokenReconciliation.usedGroups,
    // fonts[].weights/faces, …) and would truncate the block, corrupting the file. A function
    // replacement also prevents `$`-sequences in newContent from being interpreted by String.replace.
    const regex = /export\s+const\s+tokens\s*:\s*IDesignSystemTokens\[\]\s*=\s*\[[\s\S]*\]\s*;?/;
    return code.replace(regex, () => `export const tokens: IDesignSystemTokens[] = [\n${newContent}\n];`);
}
