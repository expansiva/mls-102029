/// <mls fileReference="_102029_/l2/libCommom.test.ts" enhancement="_blank"/>

import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessageKey } from '/_102029_/l2/libCommom.js';

const MESSAGES = { en: { hello: 'hello' }, pt: { hello: 'olá' } };

type MlsSites = { sites?: { getLanguage?: () => string | undefined } };
type Doc = { documentElement: { lang: string } };

function withLang(
    opts: { getLanguage?: (() => string | undefined) | null; documentLang?: string | null },
    run: () => void,
) {
    const g = globalThis as typeof globalThis & { mls?: MlsSites; document?: Doc };
    const previousMls = g.mls;
    const previousDocument = g.document;
    try {
        if (opts.getLanguage) {
            g.mls = { ...(previousMls || {}), sites: { getLanguage: opts.getLanguage } };
        } else if (opts.getLanguage === null) {
            g.mls = { ...(previousMls || {}), sites: undefined };
        }
        if (opts.documentLang === null) {
            delete g.document;
        } else if (typeof opts.documentLang === 'string') {
            g.document = { documentElement: { lang: opts.documentLang } };
        }
        run();
    } finally {
        if (previousMls) g.mls = previousMls; else delete g.mls;
        if (previousDocument) g.document = previousDocument; else delete g.document;
    }
}

test('Studio: document lang=pt with no mls.sites.getLanguage resolves pt', () => {
    withLang({ getLanguage: null, documentLang: 'pt' }, () => {
        assert.equal(getMessageKey(MESSAGES), 'pt');
    });
});

test('Runtime: mls.sites.getLanguage wins over document', () => {
    withLang({ getLanguage: () => 'pt', documentLang: 'en' }, () => {
        assert.equal(getMessageKey(MESSAGES), 'pt');
    });
});

test('Host: no mls.sites and no document returns the first key en', () => {
    withLang({ getLanguage: null, documentLang: null }, () => {
        assert.equal(getMessageKey(MESSAGES), 'en');
    });
});
