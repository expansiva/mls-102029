/// <mls fileReference="_102029_/l2/libMindMap.ts" enhancement="_blank"/>

import { getPath } from '/_102029_/l2/utils.js';

export const allDefs: Record<string, IdefModule> = {};

export async function getAllDefs(): Promise<Record<string, IdefModule>>{
    await loadAllDefs();
    return { ...allDefs };
}

export async function getDefsByFile(file: mls.stor.IFileInfo): Promise<mls.defs.AsIs | undefined>{

    await loadAllDefs();
    const key = mls.stor.getKeyToFile({...file, extension:'.defs.ts'});
    return allDefs[key] ? { ...allDefs[key].defs } : undefined;

}

export async function getMindMapByName(file: string): Promise<MindMapData | undefined> {

    try {

        if (!file) throw new Error(`Not found file: ${file}`);

        const info = getPath(file);
        if (!info || !info.shortName) return;
        let { project, folder, shortName } = info;
        folder = folder.replace('/l2', '').trim();
        shortName = shortName.replace('.defs.ts', '').trim();
        shortName = shortName.replace('.ts', '').trim();

        const key = mls.stor.getKeyToFile({ project, level: 2, shortName, folder, extension: '.defs.ts' });

        if (!mls.stor.files[key]) throw new Error(`Not found mls.stor: ${key}`);
        return _getMindMapByFile(mls.stor.files[key]);

    } catch (e: any) {
        throw new Error(`Error: ${e.message}`);
    }

}

export async function getMindMapByStorFile(file: mls.stor.IFileInfo): Promise<MindMapData | undefined> {

    if (file.extension !== '.defs.ts') {
        let { project, folder, shortName, level } = file;
        const key = mls.stor.getKeyToFile({ project, folder, shortName, extension: '.defs.ts', level })
        if (!mls.stor.files[key]) throw new Error(`Not found mls.stor: ${key}`);
        file = mls.stor.files[key]
    }

    return _getMindMapByFile(file);
}

export function setMindMapVariable(bread: MindMapNode[]) {
    (window as any).mlsBreadcrumbMindMap = bread;
}

export function getMindMapVariable(): MindMapNode[] {
    return (window as any).mlsBreadcrumbMindMap || []
}



//-------------IMPLEMENTATION---------------------

async function _getMindMapByFile(file: mls.stor.IFileInfo): Promise<MindMapData | undefined> {

    await loadAllDefs();
    const key = mls.stor.getKeyToFile({ project: file.project, level: file.level, shortName: file.shortName, folder: file.folder, extension: '.defs.ts' });

    if (!allDefs[key]) return;
    const data = buildMindMapFromInsights(allDefs[key].defs);
    data.nodes = data.nodes.map((i) => {

        i = {
            ...i,
            related: Array.from(new Set(i.related))
        }
        if (i.related.length <= 1 && !['imports', 'asIs', 'importedBy'].includes(i.id)) i.related = [];
        return i

    });

    return data;

}



function buildMindMapFromInsights(input: any): MindMapData {
    const nodes: MindMapNode[] = [];

    const centerId = `service:${input.meta.fileReference}`;

    // Helper: cria nó e já registra
    const pushNode = (node: MindMapNode) => {
        nodes.push(node);
        return node;
    };

    // Helper: dedup no final
    const normalizeRelations = () => {
        nodes.forEach(n => {
            n.related = Array.from(new Set(n.related));
        });
    };

    const fileKey = input.meta.fileReference;

    // Center node (related será preenchido dinamicamente)
    const centerNode = pushNode({
        id: fileKey + '_' + centerId,
        label: input.meta.fileReference,
        type: "main",
        meta: { fileKey },
        related: []
    });

    // ---------------- LANGUAGES ----------------
    if (Array.isArray(input.meta.languages) && input.meta.languages.length) {
        const groupId = fileKey + '_' + "language";

        const groupNode = pushNode({
            id: groupId,
            label: "Languages",
            type: "language",
            meta: { fileKey },
            related: []
        });

        centerNode.related.push(groupId);

        input.meta.languages.forEach((lang: string) => {
            const id = fileKey + '_' + `lang:${lang}`;

            pushNode({
                id,
                label: lang.toUpperCase(),
                type: "attributes",
                meta: { fileKey },
                related: [groupId]
            });

            groupNode.related.push(id);
        });
    }

    // ---------------- WEB COMPONENTS ----------------
    if (Array.isArray(input.references?.webComponents) && input.references.webComponents.length) {
        const groupId = fileKey + '_' + "webComponents";

        const groupNode = pushNode({
            id: groupId,
            label: "Web Components",
            type: "webcomponent",
            meta: { fileKey },
            related: []
        });

        centerNode.related.push(groupId);

        input.references.webComponents.forEach((wc: string) => {
            const id = fileKey + '_' + `wc:${wc}`;

            pushNode({
                id,
                label: wc,
                type: "file_wc",
                related: [groupId],
                meta: { fileKey },
                navigate: true
            });

            groupNode.related.push(id);
        });
    }

    // ---------------- IMPORTS ----------------
    if (Array.isArray(input.references?.imports) && input.references.imports.length) {
        const groupId = fileKey + '_' + "imports";

        const groupNode = pushNode({
            id: groupId,
            label: "Imports",
            type: "imports",
            meta: { fileKey },
            related: []
        });

        centerNode.related.push(groupId);

        input.references.imports.forEach((imp: any) => {
            const importId = fileKey + '_' + `import:${imp.ref}`;

            let text = '';
            (imp.dependencies || []).forEach((dep: any) => {
                text = `${text}<li>${dep.name}</li>`
            });
            if (text !== '') text = `<ul>${text}</ul>`;

            pushNode({
                id: importId,
                label: imp.ref,
                type: "file",
                related: [groupId],
                navigate: true,
                meta: { fileKey },
                description: text
            });

            groupNode.related.push(importId);

        });
    }

    // ---------------- IMPORTED BY ----------------
    if (Array.isArray(input.references?.importedBy) && input.references.importedBy.length) {
        const groupId = fileKey + '_' + "importedBy";

        const groupNode = pushNode({
            id: groupId,
            label: "ImportedBy",
            type: "importedBy",
            meta: { fileKey },
            related: []
        });

        centerNode.related.push(groupId);

        input.references.importedBy.forEach((wc: string) => {
            const id = fileKey + '_' + `importedBy:${wc}`;

            pushNode({
                id,
                label: wc,
                type: "file_wc",
                related: [groupId],
                meta: { fileKey },
                navigate: true
            });

            groupNode.related.push(id);
        });
    }

    // ---------------- CODE INSIGHTS ----------------
    const insights = input.codeInsights || {};
    if (Object.keys(insights).length) {
        const groupId = fileKey + '_' + "codeInsights";

        const groupNode = pushNode({
            id: groupId,
            label: "Code Insights",
            type: "codeInsights",
            meta: { fileKey },
            related: []
        });

        centerNode.related.push(groupId);

        Object.entries(insights).forEach(([key, value]) => {
            const sectionId = fileKey + '_' + `insight:${key}`;
            let description = joinStringArrayDescription(value);
            description = description === '<ul></ul>' ? '' : description;

            pushNode({
                id: sectionId,
                label: key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
                type: "text",
                related: [groupId],
                meta: { fileKey },
                description
            });

            groupNode.related.push(sectionId);
        });
    }

    // ---------------- AS IS ----------------
    const asIs = input.asIs || {};
    const semantic = asIs.semantic || {};

    if (Object.keys(semantic).length) {
        const groupId = fileKey + '_' + "asIs";

        const groupNode = pushNode({
            id: groupId,
            label: "As Is",
            type: "asIs",
            meta: { fileKey },
            related: ['asIs:semantic']
        });

        centerNode.related.push(groupId);

        const semanticId = fileKey + '_' + "asIs:semantic";
        const semanticNode = pushNode({
            id: semanticId,
            label: "Semantic",
            type: "attributes",
            meta: { fileKey },
            related: [groupId]
        });

        groupNode.related.push(semanticId);

        Object.entries(semantic).forEach(([key, value]) => {
            const nodeId = fileKey + '_' + `asIs:semantic:${key}`;
            let description = joinStringArrayDescription(value);
            description = description === '<ul></ul>' ? '' : description;

            pushNode({
                id: nodeId,
                label: key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
                type: "text",
                related: [semanticId],
                meta: { fileKey },
                description
            });

            semanticNode.related.push(nodeId);
        });
    }

    normalizeRelations();

    return {
        current: fileKey + '_' + centerId,
        nodes
    };
}

function joinStringArrayDescription(value: any): string | undefined {
    if (Array.isArray(value) && value.every(v => typeof v === "string")) {
        return `<ul>${value.map((i) => `<li>${i}</li>`).join("\n")}</ul>`;
    }
    if (typeof value === "string") {
        return value;
    }
    return undefined;
}

async function loadAllDefs(): Promise<void> { 

    if (Object.keys(allDefs).length > 0) return;

    const allKeys = Object.keys(mls.stor.files).filter((k) => {
        const f = mls.stor.files[k];
        return f.extension === '.defs.ts' && f.level === 2;
    })

    for await (const key of allKeys) {

        try {
            const f = mls.stor.files[key];
            if (!f) return;
            const fileName = `/_${f.project}_/l2/${f.folder ? f.folder + '/' : ''}${f.shortName}.defs.js`;
            const m = await import(fileName);
            if (!m || !m.asis) continue;
            allDefs[key] = {
                defs: m.asis,
                file: f
            };
        } catch (e) {
            continue;
        }

    }

    configAdditionalInformations();

}

async function configAdditionalInformations() {

    configiImportedBy();

}

function configiImportedBy() {

    for  (const key of Object.keys(allDefs)) {

        try {
            const info = allDefs[key];
            const importedBy:string[] = [];
            const name = `/_${info.file.project}_/l2/${info.file.folder ? info.file.folder + '/' : ''}${info.file.shortName}.js`;

            Object.keys(allDefs).forEach((into) => {

                if (into === key) return;
                const obj = allDefs[into];
                if (!obj.defs.references?.imports) return;
                let find = obj.defs.references?.imports.find((i) => i.ref === name);
                if (find) {
                    const nameFile = `/_${obj.file.project}_/l2/${obj.file.folder ? obj.file.folder + '/' : ''}${obj.file.shortName}.js`;
                    importedBy.push(nameFile);
                }

            });

            if (!(info.defs as any).references) (info.defs as any).references = {};
            if (importedBy.length > 0) (info.defs as any).references.importedBy = importedBy;
            
        } catch (e) {
            continue;
        }

    }
    
}


export type MindMapSelected = MindMapSelectedFile | MindMapSelectedPlugin;

export interface MindMapSelectedBase {
    plugin: Function; // function to get informations
    args: string;
}

export interface MindMapSelectedFile extends MindMapSelectedBase {
    type: "file",
    file: mls.stor.IFileInfo; // file selected , level, project, shortName, folder, extension
    organism?: string;
    widget?: string;
    modelType?: mls.editor.ModelType; // .ts , .html, .less, .test.ts, .defs.ts
}

export interface MindMapSelectedPlugin extends MindMapSelectedBase {
    type: "plugin",
    file: mls.stor.IFileInfo; // file selected , level, project, shortName, folder, extension    
}

export type MindMapNodeType =
    | 'main'
    | 'asIs'
    | 'codeInsights'
    | 'webcomponent'
    | 'imports'
    | 'importedBy'
    | 'language'
    | 'attributes'
    | 'file'
    | 'file_wc'
    | 'text'
    | 'findFile'
    | 'findFile_item';

export interface MindMapNode {
    id: string;             // unique identifier
    label: string;          // label shown on the node
    type: MindMapNodeType;
    related: string[];      // ids of related nodes
    meta: Record<string, any>; // optional metadata;
    description?: string,
    navigate?: boolean
}

export interface MindMapData {
    current: string;
    nodes: MindMapNode[];
}

export interface MindMapNodeStyle {
    fill: string;    // Circle background color
    stroke: string;  // Circle border color
    text: string;    // Text color
}

export type MindMapNodeStyles = Record<string, MindMapNodeStyle>;

export interface IdefModule {
    file: mls.stor.IFileInfo;
    defs: mls.defs.AsIs;
}