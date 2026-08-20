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
