/// <mls fileReference="_102029_/l2/processCssLit.ts" enhancement="_blank" />

import { compileStyleUsingMFile, compileStyleUsingSourceString } from '/_102029_/l2/libCompileStyle.js';

export async function injectStyle(modelTS: mls.editor.IModelTS, theme: string, enhancementName: string): Promise<void> {
    injectStyleWithoutShadowRoot(modelTS, theme, enhancementName);
}

export async function injectStyleAction(sourceJS: string, sourceTS: string, sourceLess: string, sourceTokens: string, theme: string, enhancementName: string): Promise<string> {
    return _injectStyleAction(sourceJS, sourceTS, sourceLess, sourceTokens, theme, enhancementName);
}

async function _injectStyleAction(sourceJS: string, sourceTS: string, sourceLess: string, sourceTokens: string, theme: string, enhancementName: string) {
    const css = await compileStyleUsingSourceString(sourceLess, sourceTokens, theme);
    if (!css) return sourceJS;
    const newJs = addLineInConstructor(sourceJS, `if(this.loadStyle) this.loadStyle(\`${css}\`);`, enhancementName);
    if (!newJs || newJs.indexOf('/// <mls') < 0) return sourceJS;
    return newJs;
}

export async function injectStyleWithoutShadowRoot(modelTS: mls.editor.IModelTS, theme: string, enhancementName: string): Promise<void> {
    if (!modelTS) return;
    const modelStyle = mls.editor.getModels(modelTS.storFile.project, modelTS.storFile.shortName, modelTS.storFile.folder)?.style;
    if (!modelStyle) return;


    const css = await compileStyleUsingMFile(modelStyle, theme);
    if (!css) return;

    if (modelTS && modelTS.compilerResults) {
        const newJs = addLineInConstructor(modelTS.compilerResults.prodJS, `if(this.loadStyle) this.loadStyle(\`${css}\`);`, enhancementName);
        if (!newJs || newJs.indexOf('/// <mls') < 0) return;
        modelTS.compilerResults.prodJS = newJs;
        mls.stor.cache.clearObsoleteCache();
        modelTS.compilerResults.cacheVersion = generateCompactTimestamp();
        await delay(200);
        let { project, shortName, folder, extension } = modelTS.storFile;
        const version = modelTS.compilerResults.cacheVersion;
        extension = extension.replace('.ts', '.js');
        await mls.stor.cache.addIfNeed({ project, folder, shortName, version, content: newJs, extension });
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function addLineInConstructor(code: string, lineToAdd: string, enhancementName: string): string {

    const lines = code.split('\n');
    const lineEnhacement = lines.find((l) => l.trim().startsWith('/// <mls'));
    const hasEnhancementLit = (lineEnhacement || '').includes(enhancementName);
    if (!hasEnhancementLit) return code;
    let insideClass = false;
    let constructorIndex = -1;
    let superIndex = -1;
    let lineAlreadyExists = false;

    if (!code) return code;

    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();

        if (trimmedLine.includes('class ') && trimmedLine.includes(' extends ')) {
            insideClass = true;
        }

        if (insideClass && trimmedLine.startsWith('constructor(')) {
            constructorIndex = i;

            for (let j = constructorIndex + 1; j < lines.length; j++) {
                if (lines[j].trim().startsWith('super(')) {
                    superIndex = j;

                    if (lines[j + 1] && lines[j + 1].trim() === lineToAdd.trim()) {
                        lineAlreadyExists = true;
                    }
                    break;
                }
            }

            break;
        }

    }

    if (constructorIndex !== -1) {
        if (!lineAlreadyExists) {
            lines.splice(superIndex + 1, 0, `        ${lineToAdd}`);
        }
    } else {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().includes('class ') && lines[i].includes(' extends ')) {
                lines.splice(i + 1, 0, `    constructor() {`, `        super();`, `        ${lineToAdd}`, `    }`);
                break;
            }
        }
    }

    return lines.join('\n');
}


export function getCssWithoutTag(css: string, tag: string): string {
    const originalString = css;
    const regex = /(\w+-\d+)\.(\w+)\s+/;
    let modifiedString = originalString.replace(regex, ':host(.$2) ');
    const searchString = tag;
    const replacementString = '';
    modifiedString = modifiedString.replace(new RegExp(searchString, "g"), replacementString);
    modifiedString = replaceBackTicks(modifiedString);
    return modifiedString;
}

function generateCompactTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-based, so +1
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
}

function replaceBackTicks(originalString: string): string {
    const stringWithSingleQuotes = originalString.replace(/`/g, "'");
    return stringWithSingleQuotes;
}
