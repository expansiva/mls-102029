/// <mls fileReference="_102029_/l2/runtimeConfigEmit.ts" enhancement="_blank"/>

// Shared serializer for the runtime config. Both the publish CLI (nodejsSaveRuntimeConfig, via
// tsx) and the Studio agents (agentCfeRegisterFrontend / agentCbRegister) use this to emit the
// SAME l5/runtimeConfig.ts, so the emit logic lives in one place.
//
// External modules keep their navigation in their own module.ts. Mark such a module with
// `navigationFromModule: "/_<extProj>_/l2/<moduleId>/module.js"` and this serializer emits an
// `import { moduleFrontendDefinition as <alias> } from "<path>"` plus `navigation:
// <alias>.navigation` (a typed reference) instead of inlining the array — the client never
// duplicates the external module's nav.

import type { ProjectsConfig } from '/_102029_/l2/runtimeConfigTypes.js';

const REF_SENTINEL = '__RUNTIMECONFIG_NAV_REF__';

function aliasFor(projectId: string, moduleId: string): string {
    return `mod_${projectId}_${moduleId.replace(/[^A-Za-z0-9]/g, '_')}`;
}

/** Emits the full l5/runtimeConfig.ts module source for a client project. */
export function serializeRuntimeConfig(config: ProjectsConfig, clientId: string): string {

    // Deep clone so we can rewrite navigation markers without touching the caller's object.
    const clone: ProjectsConfig = JSON.parse(JSON.stringify(config));

    // path -> alias (dedupe imports for the same module.js)
    const importsByPath = new Map<string, string>();

    for (const projectId of Object.keys(clone.projects ?? {})) {
        const modules = clone.projects[projectId]?.modules ?? [];
        for (const module of modules) {
            const ref = (module as { navigationFromModule?: string }).navigationFromModule;
            if (!ref) continue;
            let alias = importsByPath.get(ref);
            if (!alias) {
                alias = aliasFor(projectId, module.moduleId);
                importsByPath.set(ref, alias);
            }
            // Replace inline nav with a sentinel string that we un-quote after JSON.stringify.
            (module as { navigation?: unknown }).navigation = `${REF_SENTINEL}${alias}`;
            delete (module as { navigationFromModule?: string }).navigationFromModule;
        }
    }

    let body = JSON.stringify(clone, null, 2);
    // Turn "…SENTINEL<alias>" into a real code reference: <alias>.navigation
    body = body.replace(new RegExp(`"${REF_SENTINEL}([A-Za-z0-9_]+)"`, 'g'), '$1.navigation');

    const importLines = [...importsByPath.entries()]
        .map(([path, alias]) => `import { moduleFrontendDefinition as ${alias} } from "${path}";`)
        .sort();

    return [
        `/// <mls fileReference="_${clientId}_/l5/runtimeConfig.ts" enhancement="_blank"/>`,
        `// AUTO-GENERATED runtime config. Do not edit by hand:`,
        `// composed from l5/project.json + each module.ts by nodejsSaveRuntimeConfig / the register agents.`,
        `import type { ProjectsConfig } from '/_102029_/l2/runtimeConfigTypes.js';`,
        ...importLines,
        ``,
        `export const runtimeConfig: ProjectsConfig = ${body};`,
        ``,
    ].join('\n');
}
