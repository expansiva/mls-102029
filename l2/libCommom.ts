/// <mls fileReference="_102029_/l2/libCommom.ts" enhancement="_blank"/>

import { getPath } from '/_102029_/l2/utils.js';

/// **collab_i18n_start** 
const message_pt = {
    updatedToday: 'atualizado hoje',
    updated: 'atualizado',
    on: 'em',
    days: 'dias',
    day: 'dia',
    ago: 'atrás',
    jan: 'Jan',
    feb: 'Fev',
    mar: 'Mar',
    apr: 'Abr',
    may: 'Mai',
    june: 'Jun',
    july: 'Jul',
    aug: 'Ago',
    sept: 'Set',
    oct: 'Out',
    nov: 'Nov',
    dec: 'Dez',
}

const message_en = {
    updatedToday: 'updated today',
    updated: 'updated',
    on: 'on',
    days: 'days',
    day: 'day',
    ago: 'ago',
    jan: 'Jan',
    feb: 'Feb',
    mar: 'Mar',
    apr: 'Apr',
    may: 'May',
    june: 'June',
    july: 'July',
    aug: 'Aug',
    sept: 'Sept',
    oct: 'Oct',
    nov: 'Nov',
    dec: 'Dec',
}

type MessageType = typeof message_en;

const messages: { [key: string]: MessageType } = {
    'en': message_en,
    'pt': message_pt
}
/// **collab_i18n_end**

const lang = getMessageKey(messages)
const msg: MessageType = messages[lang];

export function getMyKeysBranch(project: number): { branch: string, owner: string, repo: string } {

    try {

        if (!mls.stor.projects[project]) throw new Error('Not found projectInfo:' + project);

        const obj = mls.l5.getProjectDetails(project);
        if (!obj || !obj.value) throw new Error('Error getProjectDetails in:' + project);

        const json = JSON.parse(obj.value);
        if (!json) throw new Error('Error getProjectDetails .value json in:' + project);

        let info = '';

        if (!json.projectURL && json.l5_actionPrjSettings) info = json.l5_actionPrjSettings.projectURL;
        else if (json.projectURL) info = json.projectURL;
        else throw new Error('Error project info:' + project);

        if (info.endsWith('/')) info = info.substring(0, info.length - 1);
        const array = info.split('/');
        if (array.length < 3) throw new Error('Insufficient information to progress');

        return { branch: array[array.length - 3], owner: array[array.length - 2], repo: array[array.length - 1] };

    } catch (e: any) {

        throw new Error('Error get info branch: ' + e.message);

    }

}

export function createPath(project: number, shortName: string, folder: string) {
    if (!folder) return `_${project}_${shortName}`
    else return `_${project}_${folder}/${shortName}`
}

export function generateCompactTimestamp() {
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

export function getDateFormated(dt: string): string {

    let lastUpdated: string;

    const dateToday = new Date();
    const dtLastWrite = new Date(dt);
    const _MS_PER_DAY = 1000 * 60 * 60 * 24;

    // a and b are javascript Date objects
    function dateDiffInDays(a: Date, b: Date) {
        // Discard the time and time-zone information.
        const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        return Math.floor((utc2 - utc1) / _MS_PER_DAY);
    }

    const diffDays = dateDiffInDays(dtLastWrite, dateToday);
    const moreThanTwoDays = diffDays > 1;

    if (diffDays === 0) {

        lastUpdated = msg.updatedToday;

    } else if (diffDays < 30) {

        lastUpdated = `${msg.updated} ${diffDays} ${moreThanTwoDays ? msg.days : msg.day} ${msg.ago}`;

    } else {

        const lastWriteYear = dtLastWrite.getFullYear();
        const lastWriteMounth = dtLastWrite.getMonth();
        const lastWriteDay = dtLastWrite.getDate();
        const mounthFilter: any = {
            0: msg.jan,
            1: msg.feb,
            2: msg.mar,
            3: msg.apr,
            4: msg.may,
            5: msg.june,
            6: msg.july,
            7: msg.aug,
            8: msg.sept,
            9: msg.oct,
            10: msg.nov,
            11: msg.dec,
        };

        lastUpdated = `${msg.updated} ${msg.on} ${lastWriteYear}, ${lastWriteDay} ${mounthFilter[lastWriteMounth]} `;

    }

    return lastUpdated;

}

const iconCollabDefault = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSJ0cmFuc3BhcmVudCIgLz4KICA8dGV4dCB4PSIzMCIgeT0iNTYiIGZvbnQtZmFtaWx5PSJWZXJkYW5hIiBmb250LXNpemU9IjcyIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iIzQyODVGNCI+QzwvdGV4dD4KICA8dGV4dCB4PSI0MCIgeT0iNDAiIGZvbnQtZmFtaWx5PSJWZXJkYW5hIiBmb250LXNpemU9IjM4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iI0VBNDMzNSI+YzwvdGV4dD4KPC9zdmc+Cg==`;

const iconCollabNotification = `data:image/svg+xml;utf8,<svg width="60" height="60" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="60" height="60" fill="transparent"/><text x="30" y="56" font-family="Verdana" font-size="72" text-anchor="middle" font-weight="bold" fill="%234285F4">C</text><text x="40" y="40" font-family="Verdana" font-size="38" text-anchor="middle" font-weight="bold" fill="%23EA4335">c</text><circle cx="50" cy="10" r="12" fill="%23FF0000"/></svg>
`;

export function changeFavIcon(notification: boolean) {
    const link: HTMLLinkElement | null = document.querySelector("#collabcodes_icon[rel~='icon']");
    if (!link) return;
    link.href = notification ? iconCollabNotification : iconCollabDefault;
}

export function checkIfHasLocalProject() {
    const hasFilePrjLocal = Object.values(mls.stor.files).find((item) => item.project === mls.stor.LOCALPROJECTNUMBER);
    return !!hasFilePrjLocal;
}

const keyLocalProject = 'projectLocalName';
export function getLocalProjectName() {
    return localStorage.getItem(keyLocalProject) || '';
}

export function setLocalProjectName(prjName: string) {
    if (!prjName) localStorage.removeItem(keyLocalProject);
    localStorage.setItem(keyLocalProject, prjName)
}

const keyLocalProjectDependencies = 'projectLocalDependencies';
export function getLocalProjectDependencies(): number[] {
    const content = localStorage.getItem(keyLocalProjectDependencies);
    if (!content) return [];
    try {
        const dependencies = JSON.parse(content);
        if (Array.isArray(dependencies) && dependencies.every((item) => typeof item === 'number')) return dependencies;
    } catch (e) {
        // conteúdo inválido, ignora e retorna vazio
    }
    return [];
}

export function setLocalProjectDependencies(dependencies: number[]) {
    if (!dependencies || !dependencies.length) {
        localStorage.removeItem(keyLocalProjectDependencies);
        return;
    }
    localStorage.setItem(keyLocalProjectDependencies, JSON.stringify(dependencies));
}

export async function deleteLocalProject() {

    const filesToDeleteCache: Set<string> = new Set();
    const keys = Object.keys(mls.stor.files).filter((key) => key.startsWith(`${mls.stor.LOCALPROJECTNUMBER}_`));
    for (const key of keys) {
        const storFile = mls.stor.files[key];
        mls.editor.deleteModels(storFile.project, storFile.shortName, storFile.folder, true, storFile.level);
        await mls.stor.localStor.setContent(storFile, { contentType: 'string', content: null });
        const ext = storFile.extension.replace('.ts', '.js');
        let targetKey = `https://collab.codes/local/_${storFile.project}_${storFile.shortName}${ext}?v=`;
        if (storFile.folder) targetKey = `https://collab.codes/local/_${storFile.project}_${storFile.folder}/${storFile.shortName}${ext}?v=`;
        filesToDeleteCache.add(targetKey);
        delete mls.stor.files[key];
    }

    const cacheName = 'mls-v2';
    const cache = await caches.open(cacheName);
    const keysCache = await cache.keys();
    for (const request of keysCache) {
        for (const targetKey of filesToDeleteCache) {
            if (request.url.includes(targetKey)) {
                await cache.delete(request);
            }
        }
    }

    deleteLastOpenedFiles(mls.stor.LOCALPROJECTNUMBER);
    localStorage.removeItem(keyLocalProject);
    localStorage.removeItem(keyLocalProjectDependencies);

    // Se o projeto local era o último projeto selecionado, limpa para o init voltar ao projeto base
    const lastProjectDetails = localStorage.getItem(KeyProject);
    if (lastProjectDetails) {
        try {
            const details = JSON.parse(lastProjectDetails);
            if (details && details.project === mls.stor.LOCALPROJECTNUMBER) localStorage.removeItem(KeyProject);
        } catch (e) {
            // conteúdo inválido, ignora
        }
    }
}

export function isValidProjectName(name: string): boolean {
    if (!name || name.length <= 3) return false;
    const projectNameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    return projectNameRegex.test(name);
}

export function escapeHTML(str: string) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function openService(service: string, position: 'left' | 'right', level: number, args?: Record<string, string>) {

    const utils = await import('/_102029_/l2/utils.js');

    let page = top?.document.querySelector('collab-page');
    if (!page) return;
    const toolbar = page.querySelector(`collab-nav-2[toolbarposition="${position}"]`) as HTMLElement;
    if (!toolbar) return;
    if (mls.actualLevel !== level) {
        (toolbar as any).state[level][position] = '';
        selectLevel(level);
        await delay(100);
    }
    const item = toolbar.querySelector(`collab-nav-2-item[data-service="${service}"]`) as HTMLElement;
    const itemNav3Content = page.querySelector(`collab-nav-3-service[data-service="${service}"]`) as HTMLElement;

    if (itemNav3Content && args) {
        const info = getPath(service);
        if(!info) throw new Error('[openService] Not found path:' + service);
        const { shortName, folder, project } = info;
        const tagService = utils.convertFileNameToTag({ shortName, folder, project });
        const serviceItem = itemNav3Content.querySelector(tagService);
        if (serviceItem) {
            Object.entries(args).forEach((arg) => {
                const [key, value] = arg;
                serviceItem.setAttribute(key, value);
            })
        }
    }
    if (item) item.click();

    return;
}

export function selectLevel(level: number) {

    const page = top?.document.querySelector('collab-page');
    const nav = page?.querySelector('collab-nav-1') as HTMLElement;
    const objIndex = {
        0: 7,
        1: 6,
        2: 5,
        3: 4,
        4: 3,
        5: 2,
        6: 1,
        7: 0,

    } as any;
    if (!nav) return;
    nav.setAttribute('tabindexactive', objIndex[level]);

}

export async function forceServiceInstance(level: number, service: string) {

    const page = document.querySelector('collab-page');
    const nav = page?.querySelector('collab-nav-1') as HTMLElement;
    if (!nav) return;
    await (nav as any).forceInstanceIfNeed([`${service};${level}`]);

}

export async function loadFileHTMLInContainer(el: HTMLElement, shortName: string, project: number) {

    const libCompile = await import('/_102029_/l2/libCompile.js');
    const utils = await import('/_102029_/l2/utils.js');

    const keyFile = mls.stor.getKeyToFiles(project, 2, shortName, '', '.html');
    const storFile = mls.stor.files[keyFile];
    if (!storFile) throw new Error('File not founded');

    const content = await storFile.getContent();
    if (!content || typeof content !== 'string') throw new Error('File html invalid');

    el.innerHTML = '';

    const allWcs = libCompile.getAllWebComponentsInSource(content);
    el.innerHTML = content;

    allWcs.forEach((wc) => {
        const info = utils.convertTagToFileName(wc);
        if (info) {
            const script = document.createElement('script');
            script.type = 'module';
            script.id = info.shortName;
            script.src = (`/_${info.project}_${info.shortName}`);
            el.appendChild(script)
        }
    });

}

export function convertColorToHex(color: string) {

    const element = document.createElement('div');
    element.style.color = color.trim();
    document.body.appendChild(element);
    const computedColor = window.getComputedStyle(element).color;
    document.body.removeChild(element);

    if (!computedColor || !computedColor.startsWith('rgb')) {
        throw new Error(`Invalid color value: ${color}`);
    }

    const match = computedColor.match(/\d+/g);
    if (!match) return undefined;
    const rgbMatch = match.map(Number);
    const [r, g, b] = rgbMatch;

    return (
        '#' +
        [r, g, b]
            .map((val) => val.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    );
}

export async function getEnhancementName(file: { project: number, shortName: string, folder: string, level: number }): Promise<string> {
    const key = mls.editor.getKeyModel(file.project, file.shortName, file.folder, file.level);
    const mmodel = mls.editor.models[key];
    if (!mmodel || !mmodel.ts) throw new Error('model invalid');
    if (!mmodel.ts.compilerResults) throw new Error('model ts not compiled yet');
    const enhacementName = mmodel.ts.compilerResults.tripleSlashMLS?.variables.enhancement
    if (!enhacementName) throw new Error('enhacementName not valid');
    return enhacementName;
}


export async function getStyleEnhancementName(file: { project: number, shortName: string, folder: string, level: number }): Promise<string | undefined> {
    const key = mls.editor.getKeyModel(file.project, file.shortName, file.folder, file.level);
    const mmodel = mls.editor.models[key];

    const lines = mmodel.style?.model.getLinesContent();
    if (!lines) return undefined;
    const firstLine = lines[0];
    if (!firstLine.startsWith('///')) throw new Error('model style invalid, first line must be tripleslash /// <mls');

    const tripleSlash = mls.common.tripleslash.parseXMLTripleSlash(firstLine);
    const enhacementName = tripleSlash?.variables.enhancement;
    return enhacementName;

    /*
    if (!mmodel || !mmodel.style) throw new Error('model invalid');
    if (!mmodel.style.styleResults) throw new Error('model style not compiled yet');
    const enhacementName = mmodel.style.styleResults.tripleSlashMLS?.variables.enhancement
    if (!enhacementName) throw new Error('enhacementName not valid');
    return enhacementName;
    */
}

const BaseProject = 100554;
export async function loadPluginProject(project: number, scope: string, onlyEnabled: boolean = true): Promise<mls.plugin.MenuAction[]> {

    await mls.plugin.loadAll(BaseProject, false);
    const base = mls.plugin.getAllMenuActions(BaseProject, { scope: scope } as any);

    const deps = mls.l5.getProjectDependencies(project, false);
    let userMenuActions: mls.plugin.MenuAction[] = [];
    for (let dep of [project, ...deps]) {
        await mls.plugin.loadAll(dep, false);
        const actionsMenu = mls.plugin.getAllMenuActions(dep, { scope: scope } as any);
        userMenuActions = [...userMenuActions, ...actionsMenu]
    }

    const i = [...base, ...userMenuActions];

    return Array.from(
        new Map(i.map(obj => [JSON.stringify(obj), obj])).values()
    );

}

const KeyProject = 'projectDetails'
export function setProjectDetails(project: number) {
    localStorage.setItem(KeyProject, JSON.stringify({ project }));
}

export function getProjectDetails(): mls.stor.localStor.IRetProjectDetails | undefined {
    return mls.stor.localStor.getProjectDetails();
}

export function calculateTotalStringSize(source: string, limitBase: number): ICalculateTotalStringSize {

    let totalBytes = 0;
    for (const text of source) {
        const encoded = new TextEncoder().encode(text);
        totalBytes += encoded.length;
    }

    const exceededLimit = totalBytes > limitBase;

    return {
        totalsize: totalBytes, // em bytes
        exceededLimit,
        sizeFormatted: formatSize(totalBytes)
    };
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}


export async function getListNewFilesToDeleteByFolder(project: number, folder: string, includeDist: boolean = false) {

    const filesToDelete = Object.values(mls.stor.files).filter(file =>
        file.inLocalStorage &&
        (file.folder === folder || (includeDist && file.folder === `wwwroot/${folder}`)) &&
        file.project === project &&
        file.status === 'new'
    );

    return filesToDelete;
}

export async function* deleteAllFilesLocal(filesToDelete: mls.stor.IFileInfo[]) {

    const modelsToDelete: { project: number, shortName: string, folder: string, level: number }[] = Array.from(
        new Map(filesToDelete.map(({ project, shortName, folder, level }) => [shortName, { project, shortName, folder, level }])).values()
    );

    const filesToDeleteCache: Set<string> = new Set();

    for (const fileToDelete of filesToDelete) {
        await mls.stor.localStor.setContent(fileToDelete, { contentType: 'string', content: null });
        fileToDelete.onAction = undefined;
        fileToDelete.getValueInfo = undefined;

        const keyFiles = mls.stor.getKeyToFiles(
            fileToDelete.project,
            fileToDelete.level,
            fileToDelete.shortName,
            fileToDelete.folder,
            fileToDelete.extension
        );
        delete mls.stor.files[keyFiles];

        yield `Storfile deleted: ${keyFiles}`;

        const ext = fileToDelete.extension.replace('.ts', '.js');
        let targetKey = `https://collab.codes/local/_${fileToDelete.project}_${fileToDelete.shortName}${ext}?v=`;
        if (fileToDelete.folder) targetKey = `https://collab.codes/local/_${fileToDelete.project}_${fileToDelete.folder}/${fileToDelete.shortName}${ext}?v=`;
        filesToDeleteCache.add(targetKey);
    }

    for (const data of modelsToDelete) {
        const keyModel = mls.editor.getKeyModel(data.project, data.shortName, data.folder, data.level);
        mls.editor.deleteModels(data.project, data.shortName, data.folder, true, data.level);
        yield `Model deleted : ${keyModel}`;
    }

    const cacheName = 'mls-v2';
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    for (const request of keys) {
        for (const targetKey of filesToDeleteCache) {
            if (request.url.includes(targetKey)) {
                await cache.delete(request);
                yield `Cache file deleted: ${request.url}`;
            }
        }
    }
}


export async function loadModuleFromProjectOrDependency(name: string, folder: string, ext: string): Promise<any> {

    const prj = mls.actualProject;
    if (!prj) throw new Error('Not found project actual!');
    let key = mls.stor.getKeyToFiles(prj, 2, name.trim(), folder.trim(), ext);
    if (mls.stor.files[key]) return (await import('/_102029_/l2/collabImport.js')).collabImport({ project: prj, shortName: name, folder: folder });
    const info = mls.l5.getProjectDetails(prj);

    if (!info && prj !== mls.stor.LOCALPROJECTNUMBER) throw new Error('Not found project details from actual project!');
    let deps: number[] = [];
    if (info) deps = info.prj_dependencies;
    else deps = [100554]
    let prjDep = 0;
    deps.forEach((dep) => {
        if (mls.stor.files[key]) return;
        prjDep = dep;
        key = mls.stor.getKeyToFiles(dep, 2, name.trim(), folder.trim(), ext);
    });

    if (!mls.stor.files[key]) throw new Error('File not found in any dependency!');
    return await await (await import('/_102029_/l2/collabImport.js')).collabImport({ project: prjDep, shortName: name.trim(), folder: folder.trim() });
}


export function findStorFileInProjectsOrDeps(
    projectActual: number,
    level: number,
    fileName: string,
    folder: string,
    extension: string): mls.stor.IFileInfo {

    const deps = mls.l5.getProjectDependencies(projectActual, false);
    const keyActual = mls.stor.getKeyToFiles(projectActual, level, fileName, folder, extension);
    let storFile = mls.stor.files[keyActual];
    if (storFile) return storFile;
    for (let dep of deps) {
        const keyDep = mls.stor.getKeyToFiles(dep, level, fileName, folder, extension);
        storFile = mls.stor.files[keyDep];
        if (storFile) break;
    }
    return storFile;

}


const STORAGE_KEY = '_100554_serviceInit';
export function saveOpenedFile(project: number, level: number, file: OpenedFile): void {

    if (level < 0 || level > 7) {
        console.warn('Invalid level');
        return;
    }

    const data = getAllUserOpenedFiles();
    if (!data[project]) {
        data[project] = {};
    }

    const currentLevelData = data[project][level];

    if (
        typeof file === 'object' &&
        file !== null &&
        typeof currentLevelData === 'object' &&
        currentLevelData !== null
    ) {
        data[project][level] = {
            left: file.left ?? currentLevelData.left,
            right: file.right ?? currentLevelData.right,
        };
    } else {
        data[project][level] = file;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getLastOpenedFiles(project: number): UserOpenedFiles {
    const data = getAllUserOpenedFiles();
    return data[project] ?? {};
}

export function deleteLastOpenedFiles(project: number) {
    const data = getAllUserOpenedFiles();
    if (data[project]) delete data[project];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getAllUserOpenedFiles(): Record<string, UserOpenedFiles> {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
}

const STORAGE_KEY_MODULES = '_100554_modules';

export function getLastModule() {
    const dataStr = localStorage.getItem(STORAGE_KEY_MODULES);
    if (!dataStr) return;
    try {
        const modules: Record<string, string> = JSON.parse(dataStr);
        return modules;
    } catch (err) {
        return;
    }
}

export function setLastModule(project: number, moduleName: string) {
    try {
        let info: any = localStorage.getItem(STORAGE_KEY_MODULES);
        if (!info) info = '{}';
        info = JSON.parse(info);
        info[project] = moduleName;
        localStorage.setItem(STORAGE_KEY_MODULES, JSON.stringify(info));
    } catch (e) {
        console.info(e);
    } 
}

export async function getBaseTemplate(file: IInfoFile, enhancement: string = '_blank'): Promise<string> {
 
    const utils = await import('/_102029_/l2/utils.js');
    const { project, shortName, folder, extension } = file;

    const folderString = folder ? `${folder}/` : '';
    const name = `_${project}_/l2/${folderString}${shortName}${extension}`

    switch (file.extension) {
        case ('.ts'): return `/// <mls fileReference="${name}" enhancement="${enhancement}"/>\n\n// typescript new file\n`;

        case ('.html'): return `<h1>${file.shortName}</h1>`;

        case ('.less'): return `/// <mls fileReference="${name}" enhancement="${enhancement}"/>\n\n${utils.convertFileNameToTag({ project, shortName, folder })} {\n\n// Here your less\n\n }`;

        case ('.test.ts'): return `/// <mls fileReference="${name}" enhancement="${enhancement}"/>\n\n`;

        case ('.defs.ts'): return `/// <mls fileReference="${name}" enhancement="${enhancement}"/>\n\n`;

        case ('.md'): return `/// <mls fileReference="${name}" enhancement="_blank"/>\n\n`;

        default: return '';
    }

}

export async function isStorContentEqualTemplateDefault(storFile: mls.stor.IFileInfo): Promise<boolean> {

    try {
        const content = await storFile.getContent();
        if (typeof content !== 'string' || !content) return false;

        // usa o enhancement do próprio tripleslash do arquivo para gerar o template equivalente
        let enhancement = '_blank';
        const firstLine = content.split('\n')[0] || '';
        if (firstLine.startsWith('/// <mls')) {
            const parsed = mls.common.tripleslash.parseXMLTripleSlash(firstLine);
            if (parsed?.variables?.enhancement) enhancement = parsed.variables.enhancement;
        }

        const { project, folder, shortName, extension } = storFile;
        const template = await getBaseTemplate({ project, folder, shortName, extension }, enhancement);
        if (!template) return false;

        const normalize = (src: string) => src.replace(/\r\n/g, '\n').trim();
        return normalize(content) === normalize(template);

    } catch (e) {
        return false;
    }

}

export function verifyNeedAddTripleslach(info: mls.stor.IFileInfoBase, src: string, extension: string, enhancement: string = '_blank'): string {

    if (!['.ts', '.defs.ts', '.test.ts', '.less'].includes(extension)) return src;

    if (enhancement === '_blank' && extension === '.ts') enhancement = '_102029_/l2/enhancementLit';
    if (enhancement === '_blank' && extension === '.less') enhancement = '_100554_enhancementStyle';

    const folder = info.folder ? `${info.folder}/` : '';
    const name = `_${info.project}_/l2/${folder}${info.shortName}${extension}`
    const triple = `/// <mls fileReference="${name}" enhancement="${enhancement}"/>\n`

    if (src.startsWith('/// <mls ')) return src;
    return triple + src;
}

export async function getInstanceByFile(file: mls.stor.IFileInfo): Promise<Object | undefined> {

    // .defs.ts files are pure data artifacts (no instance/constructor); skip them.
    // Without this guard, key.replace('.ts', '.js') would produce e.g. foo.defs.js
    // which the service worker cannot serve when the file was saved without compilation.
    if (file.extension === '.defs.ts') return undefined;

    try {
        let { project, shortName, folder, extension } = file;
        if (file.extension === '.ts') extension = '';

        let key = `/_${project}_/l2/${shortName}${extension}`;
        if (folder) key = `/_${project}_/l2/${folder}/${shortName}${extension}`;
        key = key.replace('.ts', '.js');
        const m = await import(key);
        return m;
    } catch (e) {
        return undefined;
    }

}

export function isNameValid(project: number, shortName: string, folder: string, level: number, extension: string): boolean {

    let isValid = false;

    if (project === 0 || !project || project === null) return isValid;
    if (shortName === '' || !shortName || shortName === null) return isValid;


    if (shortName.length === 0 || shortName.length > 255) return isValid;

    if (/\s/.test(shortName)) return false;
    if (/^\d+$/.test(shortName)) return false;
    if (/^\d/.test(shortName)) return false;

    if (folder && /\s/.test(folder)) return false;
    if (folder && /^\d+$/.test(folder)) return false;
    if (folder && /^\d/.test(folder)) return false;


    const invalidCharactersShortName = /[_\/{}\[\]\*$@#=\-+!|?,<>=.;^~º°""''``áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]/;

    if (invalidCharactersShortName.test(shortName)) return isValid;

    const key = mls.stor.getKeyToFiles(project, level, shortName, folder, extension);

    let find = false;
    const keys = Object.keys(mls.stor.files);
    for (const k of keys) {
        if (key.toLocaleLowerCase() === k.toLocaleLowerCase()) find = true;
    }

    if (mls.stor.files[key] || find) return isValid;

    const invalidsFolderAndName = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'collab'];

    if (invalidsFolderAndName.includes(shortName.toLocaleLowerCase())) return isValid;

    if (folder) {

        let isValidFolder = true;

        if (folder.startsWith('_') && level !== 1) return isValid;

        for (const inv of invalidsFolderAndName) {

            if (folder.indexOf(inv) >= 0) isValidFolder = false;

        }

        if (!isValidFolder) return isValid;
        if (hasInvalidCharacter(`${folder}/${shortName}`)) return isValid;
    }

    return true;

}

function hasInvalidCharacter(name: string): boolean {
    const invalidCharacters = /[\{}\[\]\*$@#=\-+!|?,<>=.;^~º°""''``áàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ]/;
    if (invalidCharacters.test(name) || name.indexOf("\\") >= 0) return true;
    return false
}

export async function openElementInServiceDetails(el: HTMLElement) {
    const serviceDetails = mls.services['100554_serviceDetail_right'];
    if (!serviceDetails) return;
    serviceDetails.openMe();
    serviceDetails.updateContentPluginWithElement(el);
}

export async function clearServiceDetails() {
    const serviceDetails = mls.services['100554_serviceDetail_right'];
    if (!serviceDetails) return;
    serviceDetails.clear();
}

export async function getProjectConfig(project: number): Promise<IProjectConfig | undefined> {
    const moduleProject = await (await import('/_102029_/l2/collabImport.js')).collabImport({ folder: '', project, shortName: 'project', extension: '.ts' });;
    if (!moduleProject) return undefined;
    return moduleProject.projectConfig;
}

export async function getProjectModuleConfig(path: string, project: number): Promise<IProjectModuleConfig | undefined> {
    const moduleConfig = await (await import('/_102029_/l2/collabImport.js')).collabImport({ folder: path, project, shortName: 'module', extension: '.ts' });
    if (!moduleConfig) return undefined;
    return moduleConfig.moduleConfig;
}

export function getMessageKey(messages: any): string {
  const keys = Object.keys(messages);
  if (!keys || keys.length < 1) throw new Error('Error Message not valid for international');
  const firstKey = keys[0];
  const sitesLang = (globalThis as { mls?: { sites?: { getLanguage?: () => string | undefined } } }).mls?.sites?.getLanguage?.();
  const lang = String(sitesLang || (typeof document !== "undefined" ? document.documentElement.lang : "") || "").toLowerCase();
  if (!lang) return firstKey;
  if (messages.hasOwnProperty(lang)) return lang;
  const similarLang = keys.find((key: string) => lang.substring(0, 2) === key);
  if (similarLang) return similarLang;
  return firstKey;
}


export type OpenedFile = string | OpenedFileL2;
export type UserOpenedFiles = Record<number, OpenedFile>;
export type OpenedFileL2 = { left?: string; right?: string };

export interface IProjectModuleConfig {
    theme: string,
    initialPage: string
    menu: IProjectModuleConfigMenu[]
}

export interface IProjectModuleConfigMenu {
    pageName: string,
    title: string,
    auth: string,
    icon?: string,
    target?: string,

}
export interface IProjectConfigModules {
    name: string,
    path: string,
    pathServer?: string,
    auth: string,
    icon?: string
}

export interface IProjectConfig {
    masterFrontEnd?: {
        build: string,
        start: string,
        liveView: string,
    },
    masterBackEnd?: {
        build: string,
        start: string,
        serverView: string,
    },
    modules: IProjectConfigModules[]
}

interface ICalculateTotalStringSize {
    totalsize: number, // em bytes
    exceededLimit: boolean,
    sizeFormatted: string
}

interface IInfoFile {
    project: number,
    folder: string,
    shortName: string,
    extension: string
}
