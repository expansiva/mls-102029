/// <mls fileReference="_102029_/l2/libModel.ts" enhancement="_blank"/>

import { getEnhancementName, getStyleEnhancementName, getBaseTemplate } from '/_102029_/l2/libCommom.js';
import { getTokensLess, removeTokensFromSource } from '/_102029_/l2/designSystemEditorBase.js';
import { getPath } from '/_102029_/l2/utils.js';
import { getDefsByFile } from '/_102029_/l2/libMindMap.js';

export async function waitModelIdle(
    model: mls.editor.IModelBase | undefined
): Promise<void> {

    const mm: IModelBase = model as IModelBase;
    if (!mm?.processing) {
        return;
    }
    await mm.processing.whenIdle();
}

export async function readProjectTypescriptAndCompile(project: number, shortName: string, needCompile: boolean = true) {

    if (projectsLoaded.includes(project)) return;
    if (mls.istrace) console.log('loading files from project ' + project);
    projectsLoaded.push(project);

    const promises: Promise<mls.editor.IModels | mls.editor.IModelBase | undefined>[] = [];
    const keys: string[] = Object.keys(mls.stor.files);

    if ((window as any).traceLivecicle) console.info('creating: files model ', project);

    const deps = mls.l5.getProjectDependencies(project, false);
    const projectWithDeps = [project, ...deps]

    for (const key of keys) {
        const storFile = mls.stor.files[key];
        if (projectWithDeps.includes(storFile.project)
            && storFile.level === 2
            && storFile.extension === '.ts'
            && (mls.istrace || storFile.inLocalStorage)
            && storFile.shortName !== shortName) {
            // createStorIfNeed=false: loading a project must never materialize
            // missing .less/.html/.test.ts/.defs.ts stor files.
            //promises.push(createAllModels(storFile, false, false, false));
            promises.push(createModel(storFile, false, false));
        }
    }

    const info = await mls.stor.localDB.readPrjInfo(baseProject);
    if (info && info.indexModules && info.indexModules !== '') {
        promises.push(_createProjectModel(baseProject, info.indexModules));
    }

    const prj = mls.actualProject;
    if (prj && prj !== baseProject && prj !== mls.stor.LOCALPROJECTNUMBER) {
        const actual = await mls.stor.localDB.readPrjInfo(prj);
        if (actual && actual.indexModules && actual.indexModules !== '') {
            promises.push(_createProjectModel(prj, actual.indexModules));
        }
    }

    if (mls.istrace) console.time('creating models');
    await Promise.all(promises);
    if (mls.istrace) console.timeEnd('creating models');

}

export async function readProjectTypescriptAndCompileL1(project: number, shortName: string, needCompile: boolean = true) {

    if (projectsLoadedL1.includes(project)) return;
    if (mls.istrace) console.log('loading files L1 from project ' + project);
    projectsLoadedL1.push(project);

    const promises: Promise<mls.editor.IModels | mls.editor.IModelBase | undefined>[] = [];
    const keys: string[] = Object.keys(mls.stor.files);

    if ((window as any).traceLivecicle) console.info('creating: files model ', project);

    for (const key of keys) {
        const storFile = mls.stor.files[key];
        if (storFile.project === mls.actualProject
            && storFile.level === 1
            && storFile.extension === '.ts'
            && storFile.shortName !== shortName) {
            promises.push(createModel(storFile, true, false));
        }
    }

    if (mls.istrace) console.time('creating models L1');
    await Promise.all(promises);
    if (mls.istrace) console.timeEnd('creating models L1');

}

export async function createAllModels(storFileBase: mls.stor.IFileInfo, needCompile: boolean = true, awaitCompile: boolean = false, createStorIfNeed: boolean = true): Promise<mls.editor.IModels | undefined> {

    const storFiles = await mls.stor.getFiles({ project: storFileBase.project, shortName: storFileBase.shortName, folder: storFileBase.folder, loadContent: true, });

    let fileModels = mls.editor.getModels(storFileBase.project, storFileBase.shortName, storFileBase.folder, storFileBase.level);

    if (storFiles.less && (!fileModels || !fileModels.style)) {
        await createModel(storFiles.less, needCompile, awaitCompile);
    } else if (createStorIfNeed && !storFiles.less && (!fileModels || !fileModels.style)) {
        storFiles.less = await createStorFiles(storFiles.ts, '.less');
        await createModel(storFiles.less, needCompile, awaitCompile);
    }

    if (storFiles.ts && (!fileModels || !fileModels.ts)) {
        await createModel(storFiles.ts, needCompile, awaitCompile);
    }

    if (storFiles.html && (!fileModels || !fileModels.html)) {
        await createModel(storFiles.html, needCompile, awaitCompile);
    } else if (createStorIfNeed && !storFiles.html && (!fileModels || !fileModels.html)) {
        storFiles.html = await createStorFiles(storFiles.ts, '.html');
        await createModel(storFiles.html, needCompile, awaitCompile);
    }

    if (storFiles.test && (!fileModels || !fileModels.test)) {
        await createModel(storFiles.test, needCompile, awaitCompile);
    } else if (createStorIfNeed && !storFiles.test && (!fileModels || !fileModels.test)) {
        storFiles.test = await createStorFiles(storFiles.ts, '.test.ts');
        await createModel(storFiles.test, needCompile, awaitCompile);
    }

    if (storFiles.defs && (!fileModels || !fileModels.defs)) {
        await createModel(storFiles.defs, needCompile, awaitCompile);
    } else if (createStorIfNeed && !storFiles.defs && (!fileModels || !fileModels.defs)) {
        storFiles.defs = await createStorFiles(storFiles.ts, '.defs.ts');
        await createModel(storFiles.defs, needCompile, awaitCompile);
    }

    fileModels = mls.editor.getModels(storFileBase.project, storFileBase.shortName, storFileBase.folder, storFileBase.level);

    return fileModels;

}

// todo: validate is need, and move to mls lib
export async function createModel(storFile: mls.stor.IFileInfo, needCompile: boolean = true, awaitCompile: boolean = false): Promise<mls.editor.IModelBase | undefined> {

    let fileModels = mls.editor.getModels(storFile.project, storFile.shortName, storFile.folder, storFile.level);
    const prop = mapExt[storFile.extension];
    if (fileModels && fileModels[prop]) return fileModels[prop];

    const key = mls.editor.getKeyModel(storFile.project, storFile.shortName, storFile.folder, storFile.level) + storFile.extension;

    if (modelPromises.has(key)) {
        return modelPromises.get(key)!;
    }

    const promise = (async () => {
        if (storFile.project > 1 && storFile.project !== mls.stor.LOCALPROJECTNUMBER) {
            await mls.stor.server.loadProjectInfoIfNeeded(storFile.project);
        }

        const src: string = storFile ? await storFile.getContent() as string : '';
        const ftype: Extesion = src.split("\n")[0].indexOf(' type="definition"') > 0 ? ".d.ts" : storFile.extension as Extesion;

        const modelBase = await _createModel(storFile, ftype, src);
        if (!modelBase) throw new Error(`[createModel] invalid mls.editor.models for file: _${storFile.project}_${storFile.shortName}${ftype}`);

        if (needCompile && modelBase.storFile.extension.endsWith('.ts')) {
            const modelTs = modelBase as mls.editor.IModelTS;
            if (modelTs && modelTs.compilerResults) modelTs.compilerResults.modelNeedCompile = true;
            if (!awaitCompile) mls.l2.typescript.compileAndPostProcess(modelBase, true, true);
            else {
                await mls.l2.typescript.compileAndPostProcess(modelBase, true, true);
                const mts = (modelBase as mls.editor.IModelTS);
                if (mts.compilerResults && mts.compilerResults.errors.length <= 0) {
                    modelBase.storFile.hasError = false;
                }
            }
        }

        if (needCompile && modelBase.storFile.extension.endsWith('.less')) {
            if (!awaitCompile) mls.l2.less.compileStyle(modelBase);
            else {
                await mls.l2.less.compileStyle(modelBase);
                const mts = (modelBase as mls.editor.IModelStyle);
                if (mts.styleResults && mts.styleResults.errors.length <= 0) {
                    modelBase.storFile.hasError = false;
                }
            }
        }

        return modelBase;
    })();

    modelPromises.set(key, promise);

    try {
        const result = await promise;
        return result;
    } catch (e: any) {
        throw new Error('[createModel] ' + e.message);
    } finally {
        modelPromises.delete(key);
    }

}

export function setErrorOnModel(model: monaco.editor.ITextModel, line: number, startColumn: number, endColumn: number, message: string, severity: monaco.MarkerSeverity): void {
    const lineIndent = getLineIndent(model, line)
    const markerOptions = {
        severity,
        message,
        startLineNumber: line,
        startColumn: startColumn + lineIndent,
        endLineNumber: line,
        endColumn: endColumn + lineIndent,
    };
    monaco.editor.setModelMarkers(model, 'markerSource', [markerOptions]);
}

export async function createModelAnyFile(storFile: mls.stor.IFileInfo) {
    return _createModelAnyFile(storFile);
}

//---------AUXILIARY FUNCTIONS AND DEFINITIONS-------------
const modelPromises = new Map<string, Promise<mls.editor.IModelBase | undefined>>();

const baseProject = 100554;
const projectsLoaded: number[] = [];
const projectsLoadedL1: number[] = [];

const mapExt: Record<string, keyof typeof mls.editor.models[string]> = {
    '.ts': 'ts',
    '.html': 'html',
    '.less': 'style',
    '.test.ts': 'test',
    '.defs.ts': 'defs'
};

type Extesion = '.ts' | '.d.ts' | '.html' | '.less' | '.test.ts' | '.defs.ts';

async function _createProjectModel(project: number, contentTS: string): Promise<mls.editor.IModels> {

    let projectModel = mls.editor.getModels(project, '', '', 2);
    if (projectModel && projectModel.ts) return projectModel;
    const ftype = ".d.ts";
    const info: mls.stor.IFileInfo = {
        project,
        shortName: '',
        folder: '',
        level: 2,
        extension: '.d.ts',
        versionRef: '',
        projectDependencies: null,
        isLocalVersionOutdated: false,
        inLocalStorage: false,
        status: 'nochange',
        hasError: false,
        getContent: function (this: mls.stor.IFileInfo, defaultValue?: string | Blob | null | undefined): Promise<string | Blob | null> {
            throw new Error('Function not implemented.');
        },
        getHistory: function (this: mls.stor.IFileInfo): Promise<mls.stor.IHistory[] | null> {
            throw new Error('Function not implemented.');
        },
        getHistoryContent: function (this: mls.stor.IFileInfo, ref: string): Promise<string | null> {
            throw new Error('Function not implemented.');
        },
        saveContentInCacheIfNeed: function (): Promise<string | null> {
            throw new Error('Function not implemented.');
        },
        getOrCreateModel: async function (): Promise<mls.editor.IModelBase> {
            return await mls.editor.createModelProjectDefinition(project, contentTS)
        }
    }

    const modelsBase = await _createModel(info, ftype, contentTS)
    if (!modelsBase) throw new Error(`invalid mls.editor.models for file: _${info.project}_.d.ts`);

    return projectModel as mls.editor.IModels;

}

async function _createModel(storFile: mls.stor.IFileInfo, ext: Extesion, content?: string): Promise<mls.editor.IModelBase | undefined> {

    let src: string | Blob | null | undefined = undefined;
    let haveInfo: boolean = false;
    let info: mls.stor.IFileInfoValue | null = null;

    src = content || '';
    if (ext !== '.d.ts') {

        if (!storFile) throw new Error(`Invalid file: ${ext}`);

        if (storFile.project !== 0) {
            info = storFile.getValueInfo ? await storFile.getValueInfo() : null;
            haveInfo = !!info && !!info.content;
        }
        if (!content) {
            src = haveInfo ? info?.content : await storFile.getContent();
        } else src = content;

    }

    if (src instanceof Blob) throw new Error(`${ext} file must be string`);
    if (!src) throw new Error(`${ext} file is undefined`);

    let originalCRC = haveInfo ? info?.originalCRC : mls.common.crc.crc32(src).toString(16);

    if (ext === '.less') {
        originalCRC = haveInfo ? info?.originalCRC : mls.common.crc.crc32(removeTokensFromSource(src).trim()).toString(16)
    }

    const originalProject: number | undefined = haveInfo ? info?.originalProject : undefined;
    const originalShortName: string | undefined = haveInfo ? info?.originalShortName : undefined;
    const originalFolder: string | undefined = haveInfo ? info?.originalFolder : undefined;

    let model: IModelBase | undefined = await storFile.getOrCreateModel();
    if (!model.processing) {
        model.processing = new ModelProcessing();
    }

    if (!model) throw new Error(`Model invalid`);

    if (ext === '.less' && storFile) {
        const lessTokens = await getTokensLess(storFile.project, 'Default');
        const lineTokens = `\n\n//Start Less Tokens\n${lessTokens}\n//End Less Tokens\n`;
        src = removeTokensFromSource(src);
        src = src.trim().concat(lineTokens);
        model.model.setValue(src);
    }

    if (ext !== '.d.ts') {
        model.originalCRC = originalCRC;
        model.originalProject = originalProject;
        model.originalShortName = originalShortName;
        (model as any).originalFolder = originalFolder;
    }

    (model as any).needFormat = true;
    return model;

}

function init() {

    mls.events.addEventListener([1, 2], ['MonacoModelCreated' as any], onMonacoModelCreated);

}
init();

function onMonacoModelCreated(ev: mls.events.IEvent) {
    // console.log('onMonacoModelCreated', ev) // test
    const storFileBase = mls.stor.convertFileReferenceToFile(ev.desc || '');
    const key = mls.stor.getKeyToFile(storFileBase);
    const storFile = mls.stor.files[key];
    if (!storFile || !storFile.project) return;

    storFile.getOrCreateModel().then(async (model: mls.editor.IModelBase) => {
        if (!model) return;
        // Register model events and hooks

        if (model.originalCRC === undefined) await setOriginalCrc(model);
        storFile.onAction = (action: mls.stor.IFileInfoAction) => _afterUpdate(storFile, model.model, mapExt[storFile.extension]);
        storFile.getValueInfo = () => _getValueInfo(model);
        model.model.onDidChangeContent((e: monaco.editor.IModelContentChangedEvent) => _onModelChange(e, model, storFile));
    });
}

async function _createModelAnyFile(storFile: mls.stor.IFileInfo) {


    if ((storFile as any).isCreateModelAny) return storFile.getOrCreateModel();

    const ref = mls.stor.convertFileToFileReference(storFile);
    const uri = monaco.Uri.parse(`file://server/` + ref);
    const src = await storFile.getContent() as string;
    let model1 = monaco.editor.getModel(uri);
    if (!model1) model1 = monaco.editor.createModel(src, storFile.extension.replace('.', ''), uri);
    const m: IModelBase = {
        model: model1,
        storFile,
        codeLens: {},
        processing: new ModelProcessing()
    }

    await setModelEventAny(m, storFile)

    storFile.getOrCreateModel = async () => {
        const src = await storFile.getContent() as string;
        m.model.setValue(src);
        return m
    }
    (storFile as any).isCreateModelAny = true;
    return m;

}

export async function setModelEventAny(model: mls.editor.IModelBase, storFile: mls.stor.IFileInfo) {

    if (!model) return;
    // Register model events and hooks

    if (model.originalCRC === undefined) await setOriginalCrc(model);
    storFile.onAction = (action: mls.stor.IFileInfoAction) => _afterUpdate(storFile, model.model, mapExt[storFile.extension]);
    storFile.getValueInfo = () => _getValueInfo(model);
    model.model.onDidChangeContent((e: monaco.editor.IModelContentChangedEvent) => _onModelChange(e, model, storFile));

}

async function _afterUpdate(storFile: mls.stor.IFileInfo, model: monaco.editor.ITextModel, tp: 'defs' | 'html' | 'style' | 'test' | 'ts') {

    if (storFile.status === 'deleted') {
        await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
        const keyFiles = mls.stor.getKeyToFiles(storFile.project, storFile.level, storFile.shortName, storFile.folder, storFile.extension);
        delete mls.stor.files[keyFiles];
        return;
    }
    if (storFile.status === 'renamed') {
        const models = mls.editor.getModels(storFile.project, storFile.shortName, storFile.folder, storFile.level);
        if (!models || models[tp] === undefined) return;
        const modelByType = models[tp];
        if (!modelByType) return;
        modelByType.originalCRC = mls.common.crc.crc32(model.getValue()).toString(16);
    }

    storFile.status = 'nochange';
    await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });


}

async function _getValueInfo(activeModel: mls.editor.IModelBase): Promise<mls.stor.IFileInfoValue> {

    if (!activeModel || activeModel.model.isDisposed()) {
        return await (mls.stor.localDB as any).getContentInfoOrNull(activeModel.storFile);
    }

    let content = activeModel.model.getValue();
    if (activeModel.storFile.extension === '.less') {
        content = removeTokensFromSource(content);
    }

    const file = activeModel.storFile.inLocalStorage ? await mls.stor.localDB.readFile({
        project: activeModel.storFile.project,
        level: activeModel.storFile.level,
        shortName: activeModel.storFile.shortName,
        extension: activeModel.storFile.extension,
        folder: activeModel.storFile.folder,
    }) : { info: { originalShortName: activeModel.originalShortName, originalFolder: (activeModel as any).originalFolder, originalProject: activeModel.originalProject } };

    const rc: mls.stor.IFileInfoValue = {
        content,
        contentType: 'string',
        originalShortName: file ? file.info.originalShortName : undefined,
        originalProject: file ? file.info.originalProject : undefined,
        originalFolder: file ? file.info.originalFolder : undefined,
        originalCRC: activeModel.originalCRC
    };


    return rc;
}

// let _onChangedContent: number | undefined = undefined;

function _onModelChange(e: monaco.editor.IModelContentChangedEvent, activeModel: IModelBase, storFile: mls.stor.IFileInfo): void {
    // some changes is to simulate changes to force compile
    // clearTimeout(_onChangedContent);

    clearTimeout(activeModel.changeTimeout);
    if (activeModel.processing) {
        activeModel.processing.end();
        activeModel.processing.begin();
    }

    activeModel.changeTimeout = window.setTimeout(async () => {

        try {

            switch (storFile.extension) {

                case '.ts': {

                    const ignoreChanges =
                        (
                            e.changes.length === 1
                            && e.changes[0].range.startLineNumber === 1
                            && e.changes[0].range.endLineNumber === 1
                            && e.changes[0].range.endColumn <= 2
                        );

                    await _updateModelStatusTS(activeModel, !ignoreChanges);

                    break;
                }

                case '.html': {

                    await _updateModelStatusHTML(activeModel, true);

                    break;
                }

                case '.less': {

                    await _updateModelStatusLess(activeModel, true);

                    break;
                }

                case '.test.ts': {

                    await _updateModelStatusTest(activeModel, true);

                    break;
                }

                case '.defs.ts': {

                    await _updateModelStatusDefs(activeModel, true);

                    break;
                }

                default: {

                    await _updateModelStatusAny(activeModel, true);

                    break;
                }
            }
        }
        catch (e) {

            console.error('[onModelChange]', e);
        }
        finally {

            if (activeModel.processing) activeModel.processing.end();
        }

    }, 400);
};

const compileNeedSet = new Set<string>();
export async function _MarkCompileNeed(storFile: mls.stor.IFileInfo): Promise<void> {
    if (storFile.extension !== ".ts") return;
    const key = mls.stor.convertFileToFileReference(storFile);
    if (compileNeedSet.has(key)) return;
    compileNeedSet.add(key);
    try {
        // TODO: work
        // todo: get all files need to compile again
        // look on .defs imports on all files (mind map)
        // mark modelTS.compilerResults.modelNeedCompile = true;
        // compile
        const defs = await getDefsByFile(storFile);
        if (!defs || !defs.references || !(defs.references as any).importedBy) return;
        for await (let file of (defs.references as any).importedBy) {
            if (file.startsWith('/')) file = file.replace('/', '');
            const info = mls.stor.convertFileReferenceToFile(file);
            const key = mls.stor.getKeyToFile({ ...info, extension: '.ts' });
            const sf = mls.stor.files[key];
            if (!sf) continue;

            const m = await sf.getOrCreateModel() as mls.editor.IModelTS;
            if (!m || !m.compilerResults) continue;
            m.compilerResults.modelNeedCompile = true;
            mls.l2.typescript.compileAndPostProcess(m, true, true);

        }

    } finally {
        compileNeedSet.delete(key);
    }
}

async function _updateModelStatusHTML(modelBase: mls.editor.IModelBase, changed: boolean): Promise<void> {

    if (!modelBase.storFile) throw new Error('Invalid stor file');

    modelBase.storFile.hasError = false;

    await _checkSameContent(modelBase, modelBase.storFile);

    const position: 'left' | 'right' | 'all' = _getPosition(modelBase.model.id, mapExt[modelBase.storFile.extension]);

    _dispatchEventEditorEvents(position, modelBase.storFile);
    _dispatchEventStatusOrErrorChanged(position, modelBase.storFile);

}

async function _updateModelStatusLess(modelBase: mls.editor.IModelStyle, changed: boolean): Promise<void> {

    if (!modelBase.storFile) throw new Error('Invalid stor file');

    const position: 'left' | 'right' | 'all' = _getPosition(modelBase.model.id, mapExt[modelBase.storFile.extension]);
    const lastStatus = modelBase.styleResults ? modelBase.styleResults.errors.length > 0 : modelBase.storFile.hasError;

    modelBase.storFile.hasError = false;
    let modelValue = modelBase.model.getValue();
    const { project, shortName, folder, level } = modelBase.storFile;

    let fileModels = mls.editor.getModels(project, shortName, folder, level);
    if (!fileModels) throw new Error('[_updateModelStatusLess] Not found file models');


    const enhacementName = await getStyleEnhancementName({ project, shortName, folder, level }).catch((e: any) => undefined);


    if (!enhacementName || enhacementName === 'enhancementStyle') {
        let url = '/_100554_/l2/enhancementStyle.js';
        const enhancementInstanceLess = await import(url);
        if (enhancementInstanceLess) await enhancementInstanceLess.onAfterChange(fileModels);
    } else {
        const path = getPath(enhacementName);
        if (path && path.shortName && path.project) {
            const enhancementInstanceLess = await import(`/_${path.project}_/l2/${path.folder ? path.folder + '/' : ''}${path.shortName}.js`)
            if (enhancementInstanceLess) await enhancementInstanceLess.onAfterChange(fileModels);
        }
    }


    mls.l2.less.compileStyle(modelBase);
    modelValue = removeTokensFromSource(modelValue);

    if (fileModels.ts) {
        if (fileModels.ts.compilerResults) {
            fileModels.ts.compilerResults.modelNeedCompile = true;
        }

        const isOk = await mls.l2.typescript.compileAndPostProcess(fileModels.ts, true, true);
        fileModels.ts.storFile.hasError = !isOk;

    }


    //_dispatchEventChanged(position, modelBase.storFile);
    await _checkSameContent(modelBase, modelBase.storFile);
    _dispatchEventChangedLess(position, modelBase.storFile)
    _dispatchEventEditorEvents(position, modelBase.storFile);
    if (lastStatus) _dispatchEventStatusOrErrorChanged(position, modelBase.storFile);

}

async function _updateModelStatusTest(modelBase: mls.editor.IModelStyle, changed: boolean): Promise<void> {

    const ok = await mls.l2.typescript.compileAndPostProcess(modelBase, false, true);
    let hasError = ok === false;
    modelBase.storFile.hasError = hasError;
    await _checkSameContent(modelBase, modelBase.storFile);
    let position = _getPosition(modelBase.model.id, 'test');

    _dispatchEventEditorEvents(position, modelBase.storFile);
    _dispatchEventChanged(position, modelBase.storFile);
    //_dispatchEventTsTestChanged(position, modelBase.storFile);


}

async function _updateModelStatusDefs(modelBase: mls.editor.IModelStyle, changed: boolean): Promise<void> {

    const ok = await mls.l2.typescript.compileAndPostProcess(modelBase, false, true);
    let hasError = ok === false;
    modelBase.storFile.hasError = hasError;
    await _checkSameContent(modelBase, modelBase.storFile);
    let position = _getPosition(modelBase.model.id, 'defs');
    _dispatchEventEditorEvents(position, modelBase.storFile);
    _dispatchEventChanged(position, modelBase.storFile);
    //_dispatchEventTsDefsChanged(position, modelBase.storFile);

}

async function _updateModelStatusAny(modelBase: mls.editor.IModelStyle, changed: boolean): Promise<void> {
    modelBase.storFile.hasError = false;
    await _checkSameContent(modelBase, modelBase.storFile);
}

async function _updateModelStatusTS(modelBase: mls.editor.IModelTS, changed: boolean): Promise<void> {

    if (!modelBase.storFile) throw new Error('Invalid stor file');
    const { project, shortName, folder, level } = modelBase.storFile;

    if (project === 0 && (shortName === 'loading' || shortName === 'testFile')) return;

    modelBase.storFile.hasError = false;


    const ok = await mls.l2.typescript.compileAndPostProcess(modelBase, true, level === 2);

    let hasError = ok === false && (modelBase.compilerResults && modelBase.compilerResults.errors.length > 0);

    if (!hasError) {

        const enhacementName = await getEnhancementName({ project, shortName, folder, level: 2 }).catch((e: any) => undefined);
        if (enhacementName && enhacementName !== "_blank") {
            const path = getPath(enhacementName);
            if (!path) throw new Error('[_updateModelStatusTS] Not found path:' + enhacementName)
            const enhancementInstance: mls.l2.enhancement.IEnhancementInstance | undefined = await mls.l2.enhancement.getEnhancementModule(path).catch((e) => { console.error('Error on getEnhancementModule: ' + e.message); return undefined });
            if (enhancementInstance) await enhancementInstance.onAfterChange(modelBase);
            //console.info(' enhancementInstance run ok');

        }

        hasError = modelBase.storFile.hasError;

    }


    await _changeStatusFile(modelBase, modelBase.storFile, ((modelBase as mls.editor.IModelTS).compilerResults?.tripleSlashMLS?.variables) || undefined, hasError, changed);
}

async function _changeStatusFile(modelBase: mls.editor.IModelBase, storFile: mls.stor.IFileInfo, variables: mls.common.tripleslash.ITripleSlashVariables | undefined, hasError: boolean, changed: boolean): Promise<void> {

    if (!storFile) return; // new file dont have storFile ???
    const position: 'left' | 'right' | 'all' = _getPosition(modelBase.model.id, mapExt[storFile.extension]);

    storFile.hasError = hasError;

    _dispatchEventEditorEvents(position, modelBase.storFile);

    if (!hasError) monaco.editor.setModelMarkers(modelBase.model, 'markerSource', []);


    await _checkSameContent(modelBase, storFile);

    if (hasError) {
        _setErrorOnEditor(modelBase);
        _dispatchEventStatusOrErrorChanged(position, storFile);
        return;
    }

    if (changed) {
        _dispatchEventStatusOrErrorChanged(position, storFile);
    }


}

function _getPosition(modeIld: string, tp: 'ts' | 'html' | 'defs' | 'style' | 'test'): 'left' | 'right' | 'all' {
    let position: 'left' | 'right' | 'all';
    const idLeft = mls.editor.editors.left?.[tp]?.model.id;
    const idRight = mls.editor.editors.right?.[tp]?.model.id;
    const idActive = modeIld;
    if (idLeft === idActive && idRight === idActive) position = 'all';
    else if (idLeft === idActive) position = 'left';
    else position = 'right';
    return position;
}

async function _checkSameContent(modelBase: mls.editor.IModelBase, storFile: mls.stor.IFileInfo) {

    let sameContent: boolean = modelBase.originalCRC === mls.common.crc.crc32(modelBase.model.getValue()).toString(16);

    //if (modelBase.originalCRC === undefined) setOriginalCrc(modelBase);

    if (modelBase.storFile.extension === '.less') {
        sameContent = modelBase.originalCRC === mls.common.crc.crc32(removeTokensFromSource(modelBase.model.getValue()).trim()).toString(16);
    };

    if (sameContent) {
        if (storFile.status !== 'renamed' && (storFile.status !== 'new')) {
            storFile.status = 'nochange';
            await mls.stor.localStor.setContent(storFile, { content: null }); // clear localstorage
        }
    } else {
        if (storFile.status !== 'renamed' && (storFile.status !== 'new')) storFile.status = 'changed';
        storFile.updatedAt = new Date().toISOString();
        await mls.stor.localStor.setContent(storFile, await _getValueInfo(modelBase));
    }
}

async function setOriginalCrc(model: mls.editor.IModelBase) {

    const info = model.storFile.getValueInfo ? await model.storFile.getValueInfo() : null;

    let originalCRC = info && info.originalCRC ? info.originalCRC : mls.common.crc.crc32(model.model.getValue()).toString(16);

    if (model.storFile.extension === '.less') {
        originalCRC = info && info.originalCRC ? info.originalCRC : mls.common.crc.crc32(removeTokensFromSource(model.model.getValue()).trim()).toString(16)
    }

    if (model.storFile.extension !== '.d.ts') {
        model.originalCRC = originalCRC;
        //model.originalProject = model.storFile.project;
        //model.originalShortName = model.storFile.shortName;
    }
}

function _setErrorOnEditor(modelBaseTS: mls.editor.IModelTS) {
    const errors = modelBaseTS.compilerResults?.errors;
    if (errors && errors.length > 0) {
        errors.forEach((err) => {
            if (err.start === 0 && err.file?.fileName === '') {
                setErrorOnModel(modelBaseTS.model, 1, 0, modelBaseTS.model.getLineContent(1).length, err.messageText as string, monaco.MarkerSeverity.Error)
            }
        })
    }
}

function _dispatchEventEditorEvents(position: 'left' | 'right' | 'all', storFile: mls.stor.IFileInfo) {
    if (position === 'all') {
        mls.events.fireFileAction('editorEvents' as any, storFile, 'left');
        mls.events.fireFileAction('editorEvents' as any, storFile, 'right');
        return;
    }
    mls.events.fireFileAction('editorEvents' as any, storFile, position);
}

function _dispatchEventStatusOrErrorChanged(position: 'left' | 'right' | 'all', storFile: mls.stor.IFileInfo) {
    if (position === 'all') {
        mls.events.fireFileAction('statusOrErrorChanged', storFile, 'left', 0);
        mls.events.fireFileAction('statusOrErrorChanged', storFile, 'right', 0);
        return;
    }
    mls.events.fireFileAction('statusOrErrorChanged', storFile, position, 0);
}

function _dispatchEventChanged(position: 'left' | 'right' | 'all', storFile: mls.stor.IFileInfo) {
    if (position === 'all') {
        mls.events.fireFileAction('editorChanged', storFile, 'left', 200);
        mls.events.fireFileAction('editorChanged', storFile, 'right', 200);
        return;
    }
    mls.events.fireFileAction('editorChanged', storFile, position, 200);
}

function _dispatchEventChangedLess(position: 'left' | 'right' | 'all', storFile: mls.stor.IFileInfo) {
    if (position === 'all') {
        mls.events.fire([2], ['styleChanged'] as any, JSON.stringify({ position: 'left', storFile }), 200);
        mls.events.fire([2], ['styleChanged'] as any, JSON.stringify({ position: 'right', storFile }), 200);
        return;
    }
    mls.events.fire([2], ['styleChanged'] as any, JSON.stringify({ position, storFile }), 200);
}

async function createStorFiles(fileBase: mls.stor.IFileInfo | undefined, extension: string): Promise<mls.stor.IFileInfo> {

    if (!fileBase) throw new Error('[createStorFiles] Invalid file base!');
    if (extension === '.ts') throw new Error('Error on createStorFiles, extension .ts invalid');

    let source = await getBaseTemplate({ ...fileBase, extension });

    const params = {
        project: fileBase.project,
        level: fileBase.level,
        shortName: fileBase.shortName,
        extension: extension,
        versionRef: '0',
        folder: fileBase.folder
    };
    const file = await mls.stor.addOrUpdateFile(params);
    if (!file) throw new Error('[createStorFile] Invalid storFile');

    file.status = 'new';
    const fileInfo: mls.stor.IFileInfoValue = {
        content: source,
        contentType: 'string'
    };

    if (!(await mls.stor.localStor.setContent(file, fileInfo))) throw new Error('Error on save content on createStorFiles');
    return file;
}



function getLineIndent(model: monaco.editor.ITextModel, lineNumber: number): number {
    if (model) {
        var lineContent = model.getLineContent(lineNumber);
        var match = lineContent.match(/^\s*/);
        return match ? match[0].length : 0;
    }
    return 0;
}


// ------------------------------------------------------
// TYPES
// ------------------------------------------------------

export interface IModelProcessing {

    begin(): void;

    end(): void;

    whenIdle(): Promise<void>;

    isProcessing(): boolean;
}

export class ModelProcessing implements IModelProcessing {

    private running = 0;

    private idlePromise: Promise<void> | null = null;

    private idleResolve: (() => void) | null = null;

    public begin(): void {

        this.running++;

        if (this.running === 1) {

            this.idlePromise = new Promise<void>((resolve) => {

                this.idleResolve = resolve;
            });
        }
    }

    public end(): void {

        if (this.running > 0) {
            this.running--;
        }

        if (this.running <= 0) {

            this.running = 0;

            if (this.idleResolve) {
                this.idleResolve();
            }

            this.idleResolve = null;
            this.idlePromise = null;
        }
    }

    public async whenIdle(): Promise<void> {

        if (this.running <= 0) {
            return;
        }

        if (this.idlePromise) {
            await this.idlePromise;
        }
    }

    public isProcessing(): boolean {

        return this.running > 0;
    }
}

export interface IModelBase extends mls.editor.IModelBase {
    changeTimeout?: number;
    processing?: IModelProcessing;
}
