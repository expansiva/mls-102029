/// <mls fileReference="_102029_/l2/utils.ts" enhancement="_blank" />

export function getPath(widget: string): mls.stor.IFileInfoBase | undefined {

    return mls.actual[0].setFullName(widget).getStorFileBase();

}

export function convertTagToFileName(tag: string): {
    shortName: string;
    project: number;
    folder: string;
} | undefined {
    const parts = tag.split('--');
    const namePart = parts.pop() || '';
    const folder = parts.join('/').replace(/-(.)/g, (_, letter) => letter.toUpperCase());

    const regex = /(.+)-(\d+)$/;
    const match = namePart.match(regex);

    if (!match) return;

    const [, rest, number] = match;
    const shortName = rest.replace(/-(.)/g, (_, letter) => letter.toUpperCase());

    return {
        shortName,
        project: +number,
        folder
    };
}

export function convertFileNameToTag(info: {
    shortName: string;
    project: number;
    folder?: string;
}): string {
    const { shortName, project, folder = '' } = info;

    const kebabName = shortName.replace(/([A-Z])/g, '-$1').toLowerCase();
    const baseName = `${kebabName}-${project}`;
    const folderPrefix = folder ? folder.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/\//g, '--') + '--' : '';

    return `${folderPrefix}${baseName}`;
}

// ─── Studio run mode ──────────────────────────────────────────────────

export type StudioRunMode = 'studio' | 'studioClient';

/** Minimal read of window.collabBoot — the full shape lives in contracts/bootstrap.ts. */
interface IStudioBootLike {
    projectId?: string | number;
}

/** Lowest project id the platform assigns — anything below is not a real project. */
const MIN_PROJECT_ID = 100000;

function getStudioBoot(): IStudioBootLike | undefined {
    return (globalThis as { collabBoot?: IStudioBootLike }).collabBoot;
}

/**
 * Where the studio chrome is running:
 * - 'studio'       — on.collab.codes: the full IDE, every org/project.
 * - 'studioClient' — the client server's app page: the studio runs embedded and is
 *                    scoped to the single project that app belongs to.
 *
 * The client server (startServer, mls-102034) injects window.collabBoot on every app
 * page; the studio page never has it. Do NOT use window.mls or #collabNav1 as the
 * signal — cbeMiniCfe boots the lib and creates that marker on the client app too.
 */
export function getStudioRunMode(): StudioRunMode {
    return getStudioBoot() ? 'studioClient' : 'studio';
}

export function isStudioClient(): boolean {
    return getStudioRunMode() === 'studioClient';
}

/**
 * The single project the studio-client is pinned to; undefined in 'studio' mode.
 * collabBoot.projectId is authoritative (cbeMiniCfe feeds mls.setActualProject from it);
 * mls.actualProject is the fallback when the boot payload carries no usable id.
 */
export function getStudioScopeProject(): number | undefined {
    const boot = getStudioBoot();
    if (!boot) return undefined;
    const fromBoot = Number(boot.projectId);
    if (Number.isFinite(fromBoot) && fromBoot >= MIN_PROJECT_ID) return fromBoot;
    const fromMls = Number((globalThis as { mls?: { actualProject?: number } }).mls?.actualProject);
    return Number.isFinite(fromMls) && fromMls >= MIN_PROJECT_ID ? fromMls : undefined;
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

function getLineIndent(model: monaco.editor.ITextModel, lineNumber: number): number {
    if (model) {
        var lineContent = model.getLineContent(lineNumber);
        var match = lineContent.match(/^\s*/);
        return match ? match[0].length : 0;
    }
    return 0;
}
