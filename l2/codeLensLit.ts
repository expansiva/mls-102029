/// <mls fileReference="_102029_/l2/codeLensLit.ts" enhancement="_blank" />

import type { IDecoratorDictionary, IDecoratorDetails } from '/_102029_/l2/propiertiesLit.js';

// File: CodeLens
export function setCodeLens(model1: mls.editor.IModelTS) {
    clearCodeLens(model1);
    const { model, compilerResults, storFile } = model1;
    if (!storFile || !model || !compilerResults) return;
    const { decorators } = compilerResults;
    if (storFile.shortName.startsWith('enhancement')) return;
    setCodeLensDecoratorClass(model, decorators);
    setCodeLensServiceDetails(model);
}

function clearCodeLens(model1: mls.editor.IModelBase) {
    for (let slineNr in model1.codeLens) {
        const codeLen = model1.codeLens[slineNr];
        if (codeLen[0].id === 'helpAssistant') {
            mls.l2.codeLens.removeCodeLen(model1.model, Number.parseInt(slineNr))
        }
    }
}

function setCodeLensDecoratorClass(model: monaco.editor.ITextModel, decorators: string) {
    const objDecorators: IDecoratorDictionary = JSON.parse(decorators);
    Object.entries(objDecorators).forEach((entrie) => {
        const decoratorInfo: IDecoratorDetails = entrie[1];
        if (!decoratorInfo || decoratorInfo.type !== 'ClassDeclaration') return;
        decoratorInfo.decorators.forEach((_decorator) => {
            if (_decorator.text.startsWith('customElement(')) {
                mls.l2.codeLens.addCodeLen(model, _decorator.line + 1, { id: 'helpAssistant', title: `customElement`, jsComm: '', refs: '_100554_pluginCodelensCustomElement' });
            }
        })
    })
}

async function setCodeLensServiceDetails(model: monaco.editor.ITextModel) {
    const lines = findLinesByText(model, 'public details: IService');
    lines.forEach((line) => {
        mls.l2.codeLens.addCodeLen(model, line, { id: 'helpAssistant', title: `serviceDetails`, jsComm: '', refs: '_100554_pluginCodelensServiceDetails' });
    });
}


function findLinesByText(model: monaco.editor.ITextModel, textToFind: string): number[] {
    const lines: number[] = [];
    if (!model) return lines;
    const lineCount = model.getLineCount();
    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        const lineText = model.getLineContent(lineNumber);
        if (lineText.includes(textToFind)) {
            lines.push(lineNumber);
        }
    }
    return lines;
}