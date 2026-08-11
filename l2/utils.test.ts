/// <mls fileReference="_102029_/l2/utils.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import { getStudioRunMode, isStudioClient, getStudioScopeProject } from '/_102029_/l2/utils.js';

type MutableGlobal = {
    collabBoot?: { projectId?: string | number };
    mls?: { actualProject?: number };
};

/** `mlsActualProject`: a number installs a stub, `null` removes the global mls, undefined keeps it. */
function withGlobals(boot: MutableGlobal['collabBoot'], mlsActualProject: number | null | undefined, run: () => void) {
    const scope = globalThis as MutableGlobal;
    const previousBoot = scope.collabBoot;
    const previousMls = scope.mls;
    if (boot) scope.collabBoot = boot; else delete scope.collabBoot;
    if (typeof mlsActualProject === 'number') scope.mls = { actualProject: mlsActualProject };
    else if (mlsActualProject === null) delete scope.mls;
    try {
        run();
    } finally {
        if (previousBoot) scope.collabBoot = previousBoot; else delete scope.collabBoot;
        if (previousMls) scope.mls = previousMls; else delete scope.mls;
    }
}

test('no collabBoot means the full studio (on.collab.codes)', () => {
    withGlobals(undefined, 102051, () => {
        assert.equal(getStudioRunMode(), 'studio');
        assert.equal(isStudioClient(), false);
        // Even with an actual project, 'studio' is never scoped to one project.
        assert.equal(getStudioScopeProject(), undefined);
    });
});

test('collabBoot means studio client, scoped to the app project', () => {
    withGlobals({ projectId: '102051' }, null, () => {
        assert.equal(getStudioRunMode(), 'studioClient');
        assert.equal(isStudioClient(), true);
        assert.equal(getStudioScopeProject(), 102051);
    });
});

test('a boot payload with no usable projectId falls back to mls.actualProject', () => {
    withGlobals({}, 102045, () => {
        assert.equal(getStudioRunMode(), 'studioClient');
        assert.equal(getStudioScopeProject(), 102045);
    });
    // Below the platform's project id floor — not a real project, so not a scope either.
    withGlobals({ projectId: '42' }, null, () => {
        assert.equal(getStudioScopeProject(), undefined);
    });
});
