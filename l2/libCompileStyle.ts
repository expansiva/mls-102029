/// <mls fileReference="_102029_/l2/libCompileStyle.ts" enhancement="_blank" />

import { preCompileLess, preCompileLessAction } from '/_102029_/l2/designSystemEditorBase.js';

export async function compileStyleUsingStorFile(shortName: string, project: number, folder: string, theme: string = 'Default') {

    const keyToStorFileLess = mls.stor.getKeyToFiles(project, 2, shortName, folder, '.less');
    const storFileLess = mls.stor.files[keyToStorFileLess];
    if (!storFileLess) return;

    let val = storFileLess.getValueInfo ? (await storFileLess.getValueInfo()).content : await storFileLess.getContent();
    if (!val || typeof val !== 'string') return '';

    val = removeTokensFromSource(val);
    val = removeCommentLines(val);

    try {
        return preCompileLess2(project, val, theme);
    } catch (err: any) {
        throw new Error(err.message);
    }
}

export async function compileStyleUsingMFile(modelStyle: mls.editor.IModelStyle, theme: string = 'Default') {
    const model: monaco.editor.ITextModel = modelStyle.model;
    const { project, shortName, folder } = modelStyle.storFile;
    const keyToStorFileLess = mls.stor.getKeyToFiles(project, 2, shortName, folder, '.less');
    const storFileLess = mls.stor.files[keyToStorFileLess];
    if (!model || !storFileLess) return;
    let val = model.getValue();
    val = removeTokensFromSource(val);
    val = removeCommentLines(val);

    try {
        return preCompileLess2(project, val, theme, modelStyle);
    } catch (err: any) {
        throw new Error(err.message);
    }
}

export async function compileStyleUsingSourceString(sourceLess: string, tokens: string, theme: string = 'Default') {

    if (!sourceLess || typeof sourceLess !== 'string') return '';
    sourceLess = removeTokensFromSource(sourceLess);
    sourceLess = removeCommentLines(sourceLess);

    try {
        const tokensParsed = JSON.parse(tokens);
        return preCompileLessAction(sourceLess, tokensParsed, theme);
    } catch (err: any) {
        throw new Error(err.message);
    }
}

async function preCompileLess2(project: number, less: string, theme: string, modelStyle?: mls.editor.IModelStyle): Promise<string> {

    try {
        let newLess = await preCompileLess(project, less, theme)
        return newLess;
    } catch (e: any) {

        console.info(e);
        if (typeof e === 'string') errorCompileLess(e);
        else if (e && e.message) errorCompileLess(e.message);
        else errorCompileLess(`Error: invalid less`);
        if (modelStyle && modelStyle.storFile) {
            modelStyle.storFile.hasError = true;
        }
        return '';
    }

}

function errorCompileLess(err: string) {

    const model = mls.editor.instances[mls.editor.activeInstance].getModel();
    if (!model || model.getLanguageId() !== 'less') return;
    monaco.editor.setModelMarkers(model, 'markerSource', []);
    const markers: monaco.editor.IMarkerData[] = [];

    const markerOptions = {
        severity: monaco.MarkerSeverity.Error,
        message: err,
        startLineNumber: 0,
        startColumn: 0,
        endLineNumber: 0,
        endColumn: 50,
    };
    markers.push(markerOptions);
    monaco.editor.setModelMarkers(model, 'markerSource', markers);

}

export function removeTokensFromSource(src: string) {
    const regex = /\/\/Start Less Tokens[\s\S]*?\/\/End Less Tokens/g;
    return src.replace(regex, '');
}

export function removeCommentLines(text: string) {

    const lines = text.split('\n');
    const lineCount = lines.length - 1;

    const newLines = [];

    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        const lineContent = lines[lineNumber]
        if (!isCommentLine(lineContent)) {
            newLines.push(lineContent);
        }
    }
    const newContent = newLines.join('\n');
    return newContent;
}

export function isCommentLine(line: string) {
    if (!line) return false;
    if (line.trim().startsWith('//')) {
        return true;
    }
    return line.trim().startsWith('/*') && line.trim().endsWith('*/');
}

export interface IDesignSystemTokens {
    description: string,
    themeName: string,
    color: Record<string, string>,
    global: Record<string, string>,
    typography: Record<string, string>,
}

export interface IDesignSystem {
    tokens: IDesignSystemTokens[]
}
