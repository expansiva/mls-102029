/// <mls fileReference="_102029_/l2/libCompile.ts" enhancement="_blank"/>

import { getTokensCss, getGlobalCss } from '/_102029_/l2/designSystemEditorBase.js';
import { convertFileNameToTag, convertTagToFileName, getPath } from '/_102029_/l2/utils.js';

export const getDependenciesByHtmlFile = (file: mls.stor.IFileInfo, html: string, theme: string, withCss: boolean = false): Promise<IJSONDependence> => {
    return new Promise<IJSONDependence>(async (resolve, reject) => {
        try {
            const ret = await getDependenciesFile(file, 'byHtml', html, theme, withCss);
            resolve(ret)
        } catch (e) {
            reject(e);
        }
    });
}

export const getDependenciesByHtml = (models: mls.editor.IModels, html: string, theme: string, withCss: boolean = false): Promise<IJSONDependence> => {
    return new Promise<IJSONDependence>(async (resolve, reject) => {
        try {
            const ret = await getDependencies(models, 'byHtml', html, theme, withCss);
            resolve(ret)
        } catch (e) {
            reject(e);
        }
    });
}

export const getDependenciesByMFile = (models: mls.editor.IModels, withCss: boolean = false): Promise<IJSONDependence> => {
    if (!models.ts) throw new Error('getDependenciesByMFile: Invalid model ts');
    const { project, shortName, extension, folder } = models.ts.storFile;
    return new Promise<IJSONDependence>(async (resolve, reject) => {
        try {
            if (extension !== '.ts') throw new Error('Only myfile .ts');
            const tag = convertFileNameToTag({ project, shortName, folder });
            resolve(await getDependencies(models, tag, `<${tag}></${tag}>`, 'Default', withCss))
        } catch (e) {
            reject(e);
        }
    });
}

async function getTagsInTypescript(modelTS: mls.editor.IModelTS, tags: string[]): Promise<string[]> {
    if (!modelTS.model) throw new Error('getTagsInTypescript: Invalid model ts');
    const tagsInTypescript = getAllWebComponentsInSource(modelTS.model.getValue());
    for (const tagTs of tagsInTypescript) {
        if (!tags.includes(tagTs)) {
            const info = convertTagToFileName(tagTs);
            if (!info) continue;
            const keyModels = mls.editor.getKeyModel(info.project, info.shortName, info.folder, 2);
            const mmodels = mls.editor.models[keyModels];
            if (mmodels && mmodels.ts) {
                await getTagsInTypescript(mmodels.ts, tags);
                tags.push(tagTs);
            }
        }
    }
    return tags;
}

async function getDependencies(models: mls.editor.IModels, filename: string, html: string, theme: string, withCss: boolean = false) {


    if (!models.ts) throw new Error('getDependencies: Invalid model ts');
    const { project, shortName, folder } = models.ts.storFile;

    const myImportsMap: string[] = [];
    const myImports: string[] = [];
    const myLinks: { ref: string, rel: string }[] = [];
    const myErrors: { tag: string, error: string }[] = [];
    const myModules = {};
    let tags = extractTagsCustom(html);

    const tag = convertFileNameToTag({ project, shortName, folder });
    if (!tags.includes(tag)) tags.push(tag);
    tags = await getTagsInTypescript(models.ts, tags);

    await loadMyNeedsToCompile(
        tags,
        myImportsMap,
        myImports,
        myLinks,
        myErrors,
        myModules,
    );

    let tokens: string | undefined = await getTokensCss(project, theme);
    return {
        file: filename,
        wcComponents: tags,
        importsMap: myImportsMap,
        importsJs: myImports,
        importsLinks: myLinks,
        globalCss: '',
        tokens,
        errors: myErrors
    }
}

async function getDependenciesFile(file: mls.stor.IFileInfo, filename: string, html: string, theme: string, withCss: boolean = false) {

    const { project, shortName, folder } = file;

    const myImportsMap: string[] = [];
    const myImports: string[] = [];
    const myLinks: { ref: string, rel: string }[] = [];
    const myErrors: { tag: string, error: string }[] = [];

    const myModules = {};
    let tags = extractTagsCustom(html);

    const tag = convertFileNameToTag({ project, shortName, folder });
    if (!tags.includes(tag)) tags.push(tag);

    await loadMyNeedsToCompile(
        tags,
        myImportsMap,
        myImports,
        myLinks,
        myErrors,
        myModules,
    );

    let tokens: string | undefined = await getTokensCss(project, theme);
    let globalCss: string | undefined = await getGlobalCss(project, theme);

    return {
        file: filename,
        wcComponents: tags,
        importsMap: myImportsMap,
        importsJs: myImports,
        importsLinks: myLinks,
        globalCss,
        tokens,
        errors: myErrors
    }
}

function extractTagsCustom(html: string): string[] {

    const container = document.createElement('div');
    container.innerHTML = html;

    const customTags: Set<string> = new Set();
    const tagsException = new Set([
        'mls-showexamplecode-100529',
        'mls-usecaseadd-100529',
        'mls-head'
    ]);

    const allElements = container.querySelectorAll('*');

    allElements.forEach(element => {
        const tagName = element.tagName.toLowerCase();

        const isCustomTag = tagName.includes('-');
        const isInCodeBlock = element.closest('code') !== null;

        if (
            isCustomTag &&
            !tagsException.has(tagName) &&
            !isInCodeBlock
        ) {
            customTags.add(tagName);
        }
    });

    return Array.from(customTags);
}

/*function extrairTagsCustomizadas(html: string): string[] {

    const el = document.createElement('div');
    const regex = /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi;
    const customTags: string[] = [];
    const tagsException = ['mls-showexamplecode-100529', 'mls-usecaseadd-100529', 'mls-head'];

    let match;
    el.innerHTML = html;

    while ((match = regex.exec(html)) !== null) {

        const tag: string = match[1];
        const tagName = tag.replace('<', '').replace('>', '');
        const all = el.querySelectorAll(tagName);
        let isIntoCode = false;

        Array.from(all).forEach((i) => {

            const father = i.closest('code');
            if (father) isIntoCode = true;

        });

        if (tag.indexOf('-') >= 0
            && !customTags.includes(tag)
            && !isIntoCode
            && !tagsException.includes(tagName)) {
            customTags.push(tagName);
        }
    }
    return customTags;

}*/

async function loadMyNeedsToCompile(
    tags: string[],
    myImportsMap: string[],
    myImports: string[],
    myLinks: { ref: string, rel: string }[],
    myErrors: { tag: string, error: string }[],
    myModules: any,
) {

    try {
        if (tags.length <= 0) return;
        const info = convertTagToFileName(tags[0]);
        if (!info) return;
        const lv = mls.actualLevel === 1 ? 1 : 2;
        const key = mls.stor.getKeyToFiles(info.project, lv, info.shortName, info.folder, '.ts');
        const f = mls.stor.files[key];
        const { project, shortName, folder } = info;
        if (!project || !shortName) return;

        const ipath = { project, shortName: shortName, folder: f ? f.folder : folder } as mls.stor.IFileInfoBase;
        const enhacementName = await getEnhancementFromFetch(ipath);
        if (!enhacementName) throw new Error('enhacementName not valid');
        if (enhacementName === '_blank') {
            await getJSBlank(myImports, ipath);
            return;
        }

        if (!myModules[enhacementName]) {

            const info = getPath(enhacementName);
            if (!info) throw new Error('[] Not found path:' + enhacementName);
            const mModule = await mls.l2.enhancement.getEnhancementModule(info);

            myModules[enhacementName] = {
                jsMap: false,
                mModule
            };

        }

        await getJSImporMap(myImportsMap, enhacementName, myModules);
        await getJSImportEnhancement(myImports, enhacementName, myModules);
        await getJS(myImports, enhacementName, ipath, myModules);
        await getLinks(myLinks, enhacementName, ipath, myModules);


    } catch (e: any) {

        if (tags.length <= 0) return;
        myErrors.push({ tag: tags[0], error: e.message })

    } finally {

        tags.shift();
        if (tags.length > 0) {
            await loadMyNeedsToCompile(
                tags,
                myImportsMap,
                myImports,
                myLinks,
                myErrors,
                myModules,
            );
        }

    }

}

async function getEnhancementFromFetch(file: { project: number, shortName: string, folder: string }) {

    const url = getImportUrl(file as mls.stor.IFileInfoBase);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const txt = await response.text();
    const lines = txt.replace(/\r\n/g, '\n').split('\n');
    const mlsLine = lines.find(line => line.trim().startsWith('/// <mls '));;

    if (!mlsLine) {
        throw new Error(`Not found tag 'mls' in ${url}`);
    }

    const enhancementMatch = mlsLine.match(/enhancement="([^"]+)"/);
    if (!enhancementMatch) {
        throw new Error('Not found attr "enhancement" in ' + url);
    }

    return enhancementMatch[1];

}

function getImportUrl(info: mls.stor.IFileInfoBase): string {
    let url = `/_${info.project}_/l2/${info.shortName}`;
    if (info.folder) {
        url = `/_${info.project}_/l2/${info.folder}/${info.shortName}`
    }
    return url;
}

async function getJSImportEnhancement(myImports: string[], enhacementName: string, myModules: any) {

    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');
    const mmodule = myModules[enhacementName].mModule as mls.l2.enhancement.IEnhancementInstance;

    if (!mmodule || !mmodule.requires) return;
    const aRequire = mmodule.requires;

    aRequire.forEach((i) => {
        if (i.type !== 'import') return;
        myImports.push(i.ref);
    });

}
async function getJSImporMap(myImportsMap: string[], enhacementName: string, myModules: any) {

    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');

    if (myModules[enhacementName].jsMap) return;
    myModules[enhacementName].jsMap = true;
    const mmodule = myModules[enhacementName].mModule as mls.l2.enhancement.IEnhancementInstance;

    if (!mmodule || !mmodule.requires) return;
    const aRequire = mmodule.requires;

    aRequire.forEach((i) => {
        if (i.type !== 'cdn') return;
        myImportsMap.push(`"${i.name}": "${i.ref}"`);
    });

}

async function getJSBlank(myImports: string[], mfile: mls.stor.IFileInfoBase) {
    let key = getImportUrl(mfile);
    if (myImports.includes(key)) return;
    myImports.push(key);
}

async function getJS(myImports: string[], enhacementName: string, mfile: mls.stor.IFileInfoBase, myModules: any) {
    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');
    let key = getImportUrl(mfile);
    if (myImports.includes(key)) return;
    myImports.push(key);
}

async function getLinks(myLinks: { ref: string, rel: string }[], enhacementName: string, mfile: mls.stor.IFileInfoBase, myModules: any) {
    if (!myModules[enhacementName]) throw new Error('Enhacement not found ');

    const mmodule = myModules[enhacementName].mModule as mls.l2.enhancement.IEnhancementInstance;
    if (!mmodule || !mmodule.requires) return;
    const aRequire = mmodule.requires;

    aRequire.forEach((i: any) => {
        if (i.type !== 'link') return;
        myLinks.push({ rel: i.args, ref: i.ref });
    });
}


export function getAllWebComponentsInSource(source: string): string[] {
    const regex = /<([a-z0-9]+-[a-z0-9-]*)(?=\s|>|\/|$)/g;
    const matches = source.match(regex) || [];
    const componentNames = matches.map(tag => tag.slice(1));
    return [...new Set(componentNames)];
}


export interface IJSONDependence {
    file: string,
    wcComponents: string[],
    importsMap: string[],
    importsJs: string[],
    importsLinks: { ref: string, rel: string }[],
    tokens: string | undefined,
    globalCss: string,
    errors: { tag: string, error: string }[]
}
