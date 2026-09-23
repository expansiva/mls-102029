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
    /** O dono do MODULO servido — pode ser o master backend numa pagina de plataforma. */
    projectId?: string | number;
    /** O projeto CLIENTE do workspace, sempre. E' este que o studio edita. */
    clientProjectId?: string | number;
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
 *
 * `clientProjectId` first: it is the workspace's client project, which is what the studio edits.
 * `projectId` is the owner of the SERVED MODULE, so entering through a platform module
 * (monitor/mdm/audit, owned by the master backend) pinned the studio to the master and the client's
 * services never appeared — measured on 102047.collabcodes.com, 23/09/2026.
 * `projectId` stays as the fallback for a server that does not send the new field yet;
 * mls.actualProject is the last resort when the payload carries no usable id.
 */
export function getStudioScopeProject(): number | undefined {
    const boot = getStudioBoot();
    if (!boot) return undefined;
    const fromClient = Number(boot.clientProjectId);
    if (Number.isFinite(fromClient) && fromClient >= MIN_PROJECT_ID) return fromClient;
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
