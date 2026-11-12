/// <mls fileReference="_102029_/l2/libGitProject.ts" enhancement="_blank" />

// Projetos que vivem no GitHub/GitLab: qual provider, qual driver e qual repositório.
// Usado pelo serviceSave (100554) e pelo plugin de pull requests (100555).

export interface IGitRepoKeys {
    branch: string;
    owner: string;
    repo: string;
}

type GitDriverLoader = () => Promise<mls.stor.others.DriverIOBase>;

const gitDriverLoaders: Partial<Record<mls.cbe.Provider, GitDriverLoader>> = {};
const gitDrivers: Partial<Record<mls.cbe.Provider, mls.stor.others.DriverIOBase>> = {};

/**
 * Quem pode importar os drivers reais (mls-100554) registra aqui como criá-los.
 * Esta lib não importa o 100554: a dependência fica com quem registra.
 */
export function registerGitDriverLoader(provider: mls.cbe.Provider, loader: GitDriverLoader): void {
    gitDriverLoaders[provider] = loader;
}

export function getGitProvider(prj: number): mls.cbe.Provider | undefined {
    const driverName = mls.l5.getProjectSettings(prj)?.projectDriver;
    if (driverName === 'GitHub') return 'github';
    if (driverName === 'GitLab') return 'gitlab';
    return undefined;
}

/** Projetos carregados que usam o driver GitHub ou GitLab. */
export function listGitProjects(): number[] {
    return Object.keys(mls.stor.projects)
        .map((p) => +p)
        .filter((p) => p !== 0 && p !== mls.stor.LOCALPROJECTNUMBER && !!getGitProvider(p));
}

/** Driver real do provider do projeto. No estúdio do VM o slot github/gitlab só lê (shortName 'vm'): usa o driver registrado. */
export async function getGitDriver(prj: number): Promise<mls.stor.others.DriverIOBase> {
    const provider = getGitProvider(prj);
    if (!provider) throw new Error(`Project ${prj} does not use the github or gitlab driver`);
    const slot = mls.stor.others.getDriver(provider);
    if (slot && slot.shortName === provider) return slot;
    if (!gitDrivers[provider]) {
        const loader = gitDriverLoaders[provider];
        if (!loader) throw new Error(`Project ${prj} uses ${provider}, but the driver found is ${slot?.shortName} and no ${provider} driver was registered`);
        gitDrivers[provider] = await loader();
    }
    const driver = gitDrivers[provider];
    if (!driver || driver.shortName !== provider) throw new Error(`Project ${prj} uses ${provider}, but the driver found is ${driver?.shortName}`);
    return driver;
}

/** owner/repo/branch da url do l5/config.json do projeto: https://github.com/<branch>/<owner>/<repo> */
export async function getGitRepoKeys(prj: number): Promise<IGitRepoKeys> {
    const file = mls.stor.files[mls.stor.getKeyToFiles(prj, 5, 'config', '', '.json')];
    if (!file) throw new Error(`Not found l5/config.json in project ${prj}`);
    const content = await file.getContent();
    let url = '';
    try {
        if (typeof content === 'string') url = JSON.parse(content)?.projectSettings?.url || '';
    } catch (e: any) {
        throw new Error(`Invalid l5/config.json in project ${prj}: ${e.message}`);
    }
    if (!url) throw new Error(`Not found projectSettings.url in l5/config.json of project ${prj}`);
    const parts = url.replace(/\/+$/, '').split('/');
    if (parts.length < 6) throw new Error(`Invalid projectSettings.url in l5/config.json of project ${prj}: ${url}`);
    return { branch: parts[parts.length - 3], owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}
