/// <mls fileReference="_102029_/l2/bffClient.test.ts" enhancement="_blank"/>

// Every BFF request must say WHO is executing it, and the standard is the EMAIL: a display name is not
// unique (decision of 2026-08-18). Before this, `meta.userId` was the literal 'anonymous' on every
// request of every user — the audit trail of an ERP with billing and approvals showed nobody.
//
// It is TELEMETRY, never authorization: the server discards the identity fields of the meta on the http
// transport, so a wrong value here costs a trail, never a permission.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as unknown as Record<string, any>;
const priorDocument = g.document;
const priorTransport = g.collabBffTransport;
after(() => { g.document = priorDocument; g.collabBffTransport = priorTransport; });

/** Captures the request the client would send, through the direct-transport hook it already supports. */
function installCapture(): { sent: any[] } {
  const sent: any[] = [];
  g.collabBffTransport = {
    execBff: async (request: any) => {
      sent.push(request);
      return { response: { ok: true, data: null, error: null }, statusCode: 200 };
    },
  };
  return { sent };
}

async function loadClient(): Promise<any> {
  return import('/_102029_/l2/bffClient.js');
}

test('meta.userId carries the logged email from the session cookie', async () => {
  g.document = { cookie: 'foo=1; loginUser=wagner%40collab.codes; cauth=opaque' };
  const capture = installCapture();
  const client = await loadClient();
  client.setUserId('');   // no explicit override: the cookie answers

  await client.execBff('buildFlowFsm.clientCatalogue.qryListClient', {});
  assert.equal(capture.sent.length, 1);
  assert.equal(capture.sent[0].meta.userId, 'wagner@collab.codes');
});

test('no session, or the runtime writing anonymous, still reports anonymous', async () => {
  const client = await loadClient();
  client.setUserId('');
  g.document = { cookie: 'loginUser=anonymous' };
  const anonymous = installCapture();
  await client.execBff('x.y.z', {});
  assert.equal(anonymous.sent[0].meta.userId, 'anonymous');

  g.document = { cookie: '' };
  const none = installCapture();
  await client.execBff('x.y.z', {});
  assert.equal(none.sent[0].meta.userId, 'anonymous');
});

test('an explicit setUserId wins, and clearing it hands the answer back to the cookie', async () => {
  g.document = { cookie: 'loginUser=cookie%40collab.codes' };
  const client = await loadClient();
  client.setUserId('override@collab.codes');
  const overridden = installCapture();
  await client.execBff('x.y.z', {});
  assert.equal(overridden.sent[0].meta.userId, 'override@collab.codes');

  client.setUserId('');
  const back = installCapture();
  await client.execBff('x.y.z', {});
  assert.equal(back.sent[0].meta.userId, 'cookie@collab.codes');
});

// The cookie is read at REQUEST time, not captured at boot: the collab-auth login returns AFTER the app
// mounted, so a value read once would stay stale for the whole session.
test('a login that happens after the app mounted is picked up by the next request', async () => {
  g.document = { cookie: '' };
  const client = await loadClient();
  client.setUserId('');
  const before = installCapture();
  await client.execBff('x.y.z', {});
  assert.equal(before.sent[0].meta.userId, 'anonymous');

  g.document = { cookie: 'loginUser=late%40collab.codes' };
  const afterLogin = installCapture();
  await client.execBff('x.y.z', {});
  assert.equal(afterLogin.sent[0].meta.userId, 'late@collab.codes');
});

test('requestId is forwarded as given on direct transport and omitted when blank', async () => {
  const prior = g.collabBffTransport;
  try {
    const capture = installCapture();
    const client = await loadClient();
    const key = 'sub-abc-001';

    await client.execBff('x.y.z', { n: 1 }, { requestId: key });
    await client.execBff('x.y.z', { n: 1 }, { requestId: key });
    await client.execBff('x.y.z', { n: 2 }, { requestId: 'sub-abc-002' });
    await client.execBff('x.y.z', { n: 3 });
    await client.execBff('x.y.z', { n: 4 }, { requestId: '   ' });
    await client.execBff('x.y.z', { n: 5 }, { requestId: '' });

    assert.equal(capture.sent.length, 6);
    assert.equal(capture.sent[0].meta.requestId, key);
    assert.equal(capture.sent[1].meta.requestId, key);
    assert.equal(capture.sent[2].meta.requestId, 'sub-abc-002');
    assert.equal('requestId' in capture.sent[3].meta, false);
    assert.equal('requestId' in capture.sent[4].meta, false);
    assert.equal('requestId' in capture.sent[5].meta, false);
    assert.deepEqual(capture.sent[0].params, { n: 1 });
  } finally {
    g.collabBffTransport = prior;
  }
});

test('requestId is forwarded as given on HTTP fetch and omitted when blank', async () => {
  const priorTransport = g.collabBffTransport;
  const priorFetch = g.fetch;
  const bodies: any[] = [];
  g.collabBffTransport = undefined;
  if (g.window) g.window.collabBffTransport = undefined;
  g.fetch = async (_url: string, init?: { body?: string }) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')));
    return {
      status: 200,
      ok: true,
      text: async () => '{"ok":true,"data":null,"error":null}',
    };
  };
  try {
    const client = await loadClient();
    const key = 'sub-http-001';

    await client.execBff('x.y.z', { n: 1 }, { requestId: key });
    await client.execBff('x.y.z', { n: 1 }, { requestId: key });
    await client.execBff('x.y.z', { n: 2 }, { requestId: 'sub-http-002' });
    await client.execBff('x.y.z', { n: 3 });
    await client.execBff('x.y.z', { n: 4 }, { requestId: '   ' });

    assert.equal(bodies.length, 5);
    assert.equal(bodies[0].meta.source, 'http');
    assert.equal(bodies[0].meta.requestId, key);
    assert.equal(bodies[1].meta.requestId, key);
    assert.equal(bodies[2].meta.requestId, 'sub-http-002');
    assert.equal('requestId' in bodies[3].meta, false);
    assert.equal('requestId' in bodies[4].meta, false);
  } finally {
    g.collabBffTransport = priorTransport;
    g.fetch = priorFetch;
  }
});

const DRAFT_FORBIDDEN_PT = 'Este rascunho não é seu. Entre no modo Studio de novo para usar o seu.';
const DRAFT_FORBIDDEN_EN = 'This draft is not yours. Enter Studio mode again to use yours.';
const DRAFT_FORBIDDEN_ES = 'Este borrador no es tuyo. Entra de nuevo en el modo Studio para usar el tuyo.';

function installHttp(status: number, body: string): { events: Array<{ type: string; detail?: { routine?: string } }> } {
  const events: Array<{ type: string; detail?: { routine?: string } }> = [];
  g.collabBffTransport = undefined;
  if (g.window) g.window.collabBffTransport = undefined;
  g.window = {
    dispatchEvent(event: { type: string; detail?: { routine?: string } }) {
      events.push(event);
      return true;
    },
  };
  g.fetch = async () => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
  });
  return { events };
}

test('403 DRAFT_FORBIDDEN becomes the i18n phrase and does not announce login', async () => {
  const priorWindow = g.window;
  const priorFetch = g.fetch;
  const priorMls = g.mls;
  try {
    const envelope = JSON.stringify({
      ok: false,
      data: null,
      error: { code: 'DRAFT_FORBIDDEN', message: 'This draft is not yours to use.' },
    });
    g.document = { cookie: '', documentElement: { lang: 'pt-BR' } };
    const pt = installHttp(403, envelope);
    const client = await loadClient();
    const result = await client.execBff('studio.draft.read', {});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'DRAFT_FORBIDDEN');
    assert.equal(result.error.message, DRAFT_FORBIDDEN_PT);
    assert.equal(pt.events.length, 0);

    g.document = { cookie: '', documentElement: { lang: 'en' } };
    const en = installHttp(403, envelope);
    const inEnglish = await client.execBff('studio.draft.read', {});
    assert.equal(inEnglish.error.message, DRAFT_FORBIDDEN_EN);
    assert.equal(en.events.length, 0);

    g.mls = { sites: { getLanguage: () => 'es' } };
    g.document = { cookie: '', documentElement: { lang: 'en' } };
    const es = installHttp(403, JSON.stringify({ code: 'DRAFT_FORBIDDEN' }));
    const inSpanish = await client.execBff('studio.draft.read', {});
    assert.equal(inSpanish.error.code, 'DRAFT_FORBIDDEN');
    assert.equal(inSpanish.error.message, DRAFT_FORBIDDEN_ES);
    assert.equal(es.events.length, 0);

    g.mls = { sites: undefined };
    g.document = { cookie: '' };
    const fallbackHttp = installHttp(403, JSON.stringify({ error: { code: 'DRAFT_FORBIDDEN' } }));
    const fallback = await client.execBff('studio.draft.read', {});
    assert.equal(fallback.error.message, DRAFT_FORBIDDEN_EN);
    assert.equal(fallbackHttp.events.length, 0);
  } finally {
    g.window = priorWindow;
    g.fetch = priorFetch;
    g.collabBffTransport = priorTransport;
    if (priorMls) g.mls = priorMls; else delete g.mls;
  }
});

test('401 still announces login', async () => {
  const priorWindow = g.window;
  const priorFetch = g.fetch;
  try {
    const http = installHttp(401, 'expired');
    const client = await loadClient();
    const result = await client.execBff('studio.draft.read', {});
    assert.equal(result.error.code, 'UNAUTHENTICATED');
    assert.equal(result.error.message, 'Sessao expirada. Entre novamente.');
    assert.equal(http.events.length, 1);
    assert.equal(http.events[0].type, 'collab-bff-unauthenticated');
    assert.equal(http.events[0].detail?.routine, 'studio.draft.read');
  } finally {
    g.window = priorWindow;
    g.fetch = priorFetch;
    g.collabBffTransport = priorTransport;
  }
});

test('a 403 that is not DRAFT_FORBIDDEN stays the transport error or the envelope', async () => {
  const priorWindow = g.window;
  const priorFetch = g.fetch;
  try {
    const plain = installHttp(403, 'nope');
    const client = await loadClient();
    const transport = await client.execBff('studio.draft.read', {});
    assert.equal(transport.error.code, 'HTTP_403');
    assert.equal(transport.error.message, 'Erro do servidor (403).');
    assert.equal(plain.events.length, 0);

    const envelope = {
      ok: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Campo obrigatório' },
    };
    const other = installHttp(403, JSON.stringify(envelope));
    const kept = await client.execBff('studio.draft.read', {});
    assert.equal(kept.error.code, 'VALIDATION_ERROR');
    assert.equal(kept.error.message, 'Campo obrigatório');
    assert.equal(other.events.length, 0);
  } finally {
    g.window = priorWindow;
    g.fetch = priorFetch;
    g.collabBffTransport = priorTransport;
  }
});
