/// <mls fileReference="_102029_/l2/validateLit.ts" enhancement="_blank" />

import type { IDecoratorDictionary, IDecoratorDetails, IDecoratorClassInfo } from '/_102029_/l2/propiertiesLit.js';
import { convertFileNameToTag, setErrorOnModel } from '/_102029_/l2/utils.js';

export function validateTagName(modelTS: mls.editor.IModelTS): boolean {

    if (!modelTS || !modelTS.storFile) return false;

    const { storFile, model } = modelTS;
    const { project, shortName, folder } = storFile;

    storFile.hasError = false;
    clearErrorsOnModel(model)

    if (!modelTS.compilerResults) return false;
    if (shortName === 'enhancementLit' && project === 100554) return false;
    const decorators: IDecoratorDictionary = JSON.parse(modelTS.compilerResults.decorators);
    if (!decorators) return false;
    const decoratorToCheck = 'customElement';
    let rc: boolean = false;

    Object.entries(decorators).forEach((entrie) => {
        const decoratorInfo: IDecoratorDetails = entrie[1];
        if (!decoratorInfo || decoratorInfo.type !== 'ClassDeclaration') return;
        decoratorInfo.decorators.forEach((_decorator) => {
            const decoratorInfo = getDecoratorClassInfo(_decorator.text);
            if (!decoratorInfo || decoratorInfo.decoratorName !== decoratorToCheck) return;

            let correctTagName = convertFileNameToTag({ project, shortName, folder });
            if (correctTagName !== decoratorInfo.tagName) {
                rc = true;
                setErrorOnModel(model, _decorator.line + 1, decoratorToCheck.length + 3, _decorator.text.length + 1, `Invalid web component tag name, the correct definition is: ${correctTagName}`, monaco.MarkerSeverity.Error);
                storFile.hasError = true;
            }
        })
    })

    return rc;
}

export function validateRender(modelTS: mls.editor.IModelTS): boolean {

    if (!modelTS || !modelTS.storFile) return false;
    const { storFile, model, compilerResults } = modelTS;
    const { project, shortName, folder } = storFile;

    storFile.hasError = false;
    clearErrorsOnModel(model);
    if (!compilerResults) return false;
    if (shortName.startsWith('enhancement')) return false;
    return verify(model, project, shortName, folder)
}

function getDecoratorClassInfo(decoratorString: string): IDecoratorClassInfo | undefined {
    const regex = /(\w+)\(['"](.+?)['"]\)/;
    const match = decoratorString.match(regex);
    let result: IDecoratorClassInfo | undefined = undefined;
    if (match && match.length > 2) {
        const decoratorName = match[1];
        const tagName = match[2];
        result = {
            decoratorName,
            tagName,
        };
    }
    return result;
}

function clearErrorsOnModel(model: monaco.editor.ITextModel) {
    monaco.editor.setModelMarkers(model, 'markerSource', []);
}

function verify(model: monaco.editor.ITextModel, project: number, shortName: string, folder: string): boolean {
    const lines = model.getLinesContent();
    const tag = convertFileNameToTag({ project, shortName, folder });
    const msgError = `Do not use the same component tag (${tag}) inside the rendering, possible looping`;
    let htmlCount: number = 0;

    let rc: boolean = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        line = line.replace(/\/\/.*/, ''); // remove inline comment 
        const lineInCommentBlock = isInCommentBlock(lines, i + 1);
        line = line.replace(/\s+/g, ''); // remove blank spaces
        if (line.indexOf(`document.createElement('${tag}')`) >= 0 ||
            line.indexOf(`document.createElement("${tag}")`) >= 0) {
            // mfile.storFile.hasError = true;
            setErrorOnModel(model, i + 1, 0, line.length, msgError, monaco.MarkerSeverity.Warning);
            rc = true;
            break;
        }
        if (line.indexOf('html`') >= 0 && !lineInCommentBlock) htmlCount += 1;
        if (line.indexOf('`') >= 0 && line.indexOf('html`') === -1 && !lineInCommentBlock) htmlCount -= 1;

        if (htmlCount != 0) {
            if (line.indexOf('<' + tag) >= 0) {
                // mfile.storFile.hasError = true;
                const column = model.getLineFirstNonWhitespaceColumn(i + 1);
                const length = model.getLineLength(i + 1)
                setErrorOnModel(model, i + 1, column, length, msgError, monaco.MarkerSeverity.Warning);
                rc = true;
                break;
            }
        }
    }
    return rc;
}

function isInCommentBlock(lines: string[], lineNumber: number): boolean {
    let countStartBlockComment = 0;
    let countEndBlockComment = 0;
    for (let i = 0; i <= lineNumber - 1; i++) {
        const line = lines[i];
        if (line.indexOf('/*') >= 0) countStartBlockComment += 1;
        if (line.indexOf('*/') >= 0 && i !== lineNumber - 1) countEndBlockComment += 1;
    }
    const isInBlockComment = countStartBlockComment > countEndBlockComment;
    return isInBlockComment;
};


