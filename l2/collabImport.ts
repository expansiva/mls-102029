/// <mls fileReference="_102029_/l2/collabImport.ts" enhancement="_blank" />

interface CollabImportOptions {
    project: number;
    shortName: string;
    folder: string;
    extension?: '.defs.ts' | '.ts' | '.test.ts'
}

const moduleRegistry = new Map<string, {
    version: string;
    modulePromise: Promise<any>;
}>();

const staticImports = new Set<string>(); // Tracks modules imported outside dev mode

const extensions = {
    '.defs.ts': '.defs.js',
    '.test.ts': '.test.js',
    '.ts': '.js',
}

export async function collabImport(opts: CollabImportOptions): Promise<any> {

    if (!opts.extension) opts.extension = '.ts';

    const moduleId = opts.folder ? `${opts.project}-${opts.folder}/${opts.shortName}` : `${opts.project}-/${opts.shortName}${extensions[opts.extension]}`;
    const { isDev, storFile } = await fileInDevelopment(opts);

    if (!isDev) {
        const url = getUrlFromFileInfo(opts, storFile ? storFile.versionRef : '', false);
        staticImports.add(moduleId);
        return import(/* @vite-ignore */ url);
    }

    const version = await getFileVersion(opts);
    const cached = moduleRegistry.get(moduleId);

    if (cached && cached.version === version && opts.shortName !== 'designSystem') {
        return cached.modulePromise;
    }

    const url = getUrlFromFileInfo(opts, version, true);
    const modulePromise = import(/* @vite-ignore */ url);

    moduleRegistry.set(moduleId, { version, modulePromise });
    return modulePromise;
}

async function fileInDevelopment(opts: CollabImportOptions): Promise<{ isDev: boolean, storFile: mls.stor.IFileInfo | undefined }> {
    if (!opts.extension) opts.extension = '.ts';
    const keyToStorFile = mls.stor.getKeyToFiles(opts.project, 2, opts.shortName, opts.folder, opts.extension);
    const storFile = mls.stor.files[keyToStorFile];
    return { isDev: !!storFile?.inLocalStorage, storFile };
}

async function getFileVersion(opts: CollabImportOptions): Promise<string> {
    if (!opts.extension) opts.extension = '.ts';
    const modelKey = mls.editor.getKeyModel(opts.project, opts.shortName, opts.folder, mls.actualLevel);
    const models = mls.editor.models[modelKey];
    if (!models) return '';
    const objExt = {
        '.defs.ts': 'defs',
        '.test.ts': 'test',
        '.ts': 'ts',
    };

    const key: 'defs' | 'ts' | 'test' = objExt[opts.extension] as 'defs' | 'ts' | 'test';
    const modelByExt = models[key];
    if (!models || !modelByExt) return '';
    const crcActual = mls.common.crc.crc32(modelByExt.model.getValue()).toString(16);
    return crcActual === modelByExt.originalCRC ? '' : crcActual;
}

function getUrlFromFileInfo(opts: CollabImportOptions, version: string | null, isDev: boolean): string {
    if (!opts.extension) opts.extension = '.ts';
    if (opts.shortName === 'designSystem' && opts.folder === '' && opts.extension === '.ts') {
        const base = opts.folder ? `/_${opts.project}_/l2/${opts.folder}/${opts.shortName}` : `/_${opts.project}_/l2/${opts.shortName}`;
        return `${base}?t=${isDev ? Date.now() : version}`;
    }

    const base = opts.folder ? `/_${opts.project}_/l2/${opts.folder}/${opts.shortName}` : `/_${opts.project}_/l2/${opts.shortName}`;
    const base2 = version ? `${base}?t=${version}` : base;
    const base3 = opts.extension !== '.ts' ? `${base}${extensions[opts.extension]}` : base2
    return base3;

}