import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkMap, updateMap, validateMap } from '../scripts/update-map.mjs';

const commit = '1234567890abcdef1234567890abcdef12345678';
const commitUrl = 'https://api.github.com/repos/unset-sh/.github/commits/main';
const rawUrl = `https://raw.githubusercontent.com/unset-sh/.github/${commit}/repos.json`;
const fixture = () => ({
  org: 'unset-sh', licenceRule: 'Each repository sets its licence.',
  groups: ['product', 'look', 'records', 'building'].map(id => ({ id, title: id, blurb: `${id} responsibilities` })),
  repos: [
    { name: 'brand', status: 'active', group: 'look', tagline: 'Visual foundations', summary: 'Shared visual contract.', owns: ['Tokens'], notHere: [], uses: [], licence: { spdx: null, current: 'Recorded upstream', followsRule: true } },
    { name: 'docs', status: 'active', group: 'building', tagline: 'Documentation', summary: 'The documentation framework.', owns: ['Rendering'], notHere: [{ what: 'Tokens', where: 'brand' }], uses: [{ repo: 'brand', how: 'A pinned release (planned)' }], licence: { spdx: null, current: 'Recorded upstream', followsRule: true } },
  ],
});
async function directory(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'docs-map-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
function responder(bytes, commitBody = { sha: commit }) {
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    if (url === commitUrl) return new Response(JSON.stringify(commitBody));
    if (url === rawUrl) return new Response(bytes);
    throw new Error(`Unexpected fetch: ${url}`);
  };
}

test('preserves dependency qualifiers and accepts the upstream status vocabulary', () => {
  const data = fixture();
  for (const status of ['active', 'pending', 'planned', 'proposed', 'archived']) {
    data.repos[1].status = status;
    assert.equal(validateMap(data), data);
    assert.equal(data.repos[1].uses[0].how, 'A pinned release (planned)');
  }
});

for (const [name, change, error] of [
  ['wrong organisation', data => { data.org = 'another-org'; }, /organisation/i],
  ['unsafe repository name', data => { data.repos[0].name = '../brand'; }, /name/i],
  ['case-folded duplicate repository', data => { data.repos.push({ ...data.repos[0], name: 'BRAND' }); }, /duplicate/i],
  ['unknown status', data => { data.repos[0].status = 'ready'; }, /status/i],
  ['unknown group', data => { data.repos[0].group = 'other'; }, /group/i],
  ['duplicate group', data => { data.groups[1].id = 'product'; }, /duplicate/i],
  ['unknown dependency', data => { data.repos[1].uses[0].repo = 'missing'; }, /dependency/i],
  ['duplicate dependency', data => { data.repos[1].uses.push({ repo: 'brand', how: 'Twice' }); }, /duplicate/i],
  ['dependency cycle', data => { data.repos[0].uses.push({ repo: 'docs', how: 'Cycle' }); }, /cycle/i],
  ['self dependency', data => { data.repos[0].uses.push({ repo: 'brand', how: 'Itself' }); }, /cycle/i],
  ['missing ownership', data => { delete data.repos[0].owns; }, /owns/i],
  ['malformed boundary', data => { data.repos[1].notHere[0].where = null; }, /where/i],
  ['unsafe external link', data => { data.repos[0].links = { docs: 'javascript:alert(1)' }; }, /link/i],
  ['unexpected external repository', data => { data.repos[0].owner = 'somebody'; }, /external/i],
]) {
  test(`rejects ${name}`, () => {
    const data = fixture(); change(data);
    assert.throws(() => validateMap(data), error);
  });
}

test('allows the external app as context without changing its owner', () => {
  const data = fixture();
  data.repos[0].name = 'unset'; data.repos[0].owner = 'Undefined6799';
  data.repos[1].uses[0].repo = 'unset';
  assert.equal(validateMap(data).repos[0].owner, 'Undefined6799');
});

test('resolves main once, preserves raw bytes, and records exact commit and digest', async t => {
  const output = await directory(t);
  const bytes = Buffer.from(`${JSON.stringify(fixture(), null, 2)}\n`);
  let resolutions = 0;
  const fetcher = responder(bytes);
  await updateMap({ directory: output, fetchImpl: (url, options) => {
    if (url === commitUrl) resolutions++;
    return fetcher(url, options);
  } });
  assert.equal(resolutions, 1);
  assert.deepEqual(await readFile(path.join(output, 'repos.json')), bytes);
  const source = JSON.parse(await readFile(path.join(output, 'source.json')));
  assert.equal(source.commit, commit);
  assert.equal(source.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(source.ref, 'main');
  assert.equal((await checkMap(output)).repos.length, 2);
});

test('authenticates only the fixed commit API and never the immutable raw map download', async t => {
  const output = await directory(t);
  const bytes = JSON.stringify(fixture());
  const calls = [];
  await updateMap({ directory: output, githubToken: 'fixture-token', fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    if (url === commitUrl) {
      assert.equal(options.headers.Authorization, 'Bearer fixture-token');
      return Response.json({ sha: commit, url: 'https://outside.invalid/map' });
    }
    assert.equal(url, rawUrl);
    assert.equal(options.headers.Authorization, undefined);
    return new Response(bytes);
  } });
  assert.deepEqual(calls, [commitUrl, rawUrl]);
  assert.equal(await readFile(path.join(output, 'repos.json'), 'utf8'), bytes);
});

test('an authenticated map API failure stays closed and exposes only safe response metadata', async t => {
  const output = await directory(t);
  const bytes = JSON.stringify(fixture());
  await updateMap({ directory: output, fetchImpl: responder(bytes) });
  let calls = 0;
  await assert.rejects(updateMap({ directory: output, githubToken: 'fixture-token', fetchImpl: async () => {
    calls++;
    return new Response('private fixture-token body', { status: 403, headers: {
      'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1795363200', 'x-github-request-id': 'ABCD:1234',
      'x-ratelimit-limit': 'fixture-token', 'retry-after': 'NaN',
    } });
  } }), error => {
    assert.match(error.message, /HTTP 403/);
    assert.match(error.message, /1795363200/);
    assert.match(error.message, /ABCD:1234/);
    assert.doesNotMatch(error.stack, /fixture-token|private|NaN/);
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(await readFile(path.join(output, 'repos.json'), 'utf8'), bytes);
});

test('API and raw body stream failures redact causes and preserve the previous snapshot', async t => {
  const output = await directory(t);
  const bytes = JSON.stringify(fixture());
  await updateMap({ directory: output, fetchImpl: responder(bytes) });
  const previousSource = await readFile(path.join(output, 'source.json'));
  for (const failedUrl of [commitUrl, rawUrl]) {
    await assert.rejects(updateMap({ directory: output, githubToken: 'fixture-token', fetchImpl: async url => {
      if (url !== failedUrl) return Response.json({ sha: commit });
      return new Response(new ReadableStream({ start(controller) {
        controller.error(new Error('Authorization: Bearer fixture-token', { cause: new Error('private cause') }));
      } }));
    } }), error => {
      assert.doesNotMatch(error.stack, /fixture-token|Authorization|private cause/);
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(await readFile(path.join(output, 'repos.json'), 'utf8'), bytes);
    assert.deepEqual(await readFile(path.join(output, 'source.json')), previousSource);
  }
});

test('fetch and schema failures preserve the previous snapshot', async t => {
  const output = await directory(t);
  const bytes = JSON.stringify(fixture());
  await updateMap({ directory: output, fetchImpl: responder(bytes) });
  const before = await readFile(path.join(output, 'source.json'));
  const invalid = fixture(); invalid.repos[0].status = 'unknown';
  for (const fetchImpl of [
    async () => new Response('unavailable', { status: 503 }),
    responder(bytes, { sha: 'main' }),
    responder(JSON.stringify(invalid)),
    responder('not json'),
  ]) await assert.rejects(updateMap({ directory: output, fetchImpl }));
  assert.equal(await readFile(path.join(output, 'repos.json'), 'utf8'), bytes);
  assert.deepEqual(await readFile(path.join(output, 'source.json')), before);
});

test('offline check rejects altered bytes and untrusted provenance', async t => {
  const output = await directory(t);
  const bytes = JSON.stringify(fixture());
  await updateMap({ directory: output, fetchImpl: responder(bytes) });
  await writeFile(path.join(output, 'repos.json'), `${bytes}\n`);
  await assert.rejects(checkMap(output), /digest/i);
  await writeFile(path.join(output, 'repos.json'), bytes);
  const source = JSON.parse(await readFile(path.join(output, 'source.json')));
  source.repository = 'other/map';
  await writeFile(path.join(output, 'source.json'), JSON.stringify(source));
  await assert.rejects(checkMap(output), /provenance/i);
});

test('refuses symlink outputs before replacing files', async t => {
  const output = await directory(t);
  const outside = path.join(output, 'outside.json');
  await writeFile(outside, 'unchanged');
  await symlink(outside, path.join(output, 'repos.json'));
  await assert.rejects(updateMap({ directory: output, fetchImpl: responder(JSON.stringify(fixture())) }), /regular|symlink/i);
  assert.equal(await readFile(outside, 'utf8'), 'unchanged');
});

test('rejects non-string commit identities from the API and offline provenance', async t => {
  const output = await directory(t);
  const bytes = JSON.stringify(fixture());
  await assert.rejects(updateMap({ directory: output, fetchImpl: responder(bytes, { sha: [commit] }) }), /commit/i);
  await updateMap({ directory: output, fetchImpl: responder(bytes) });
  const source = JSON.parse(await readFile(path.join(output, 'source.json')));
  source.commit = [commit];
  await writeFile(path.join(output, 'source.json'), JSON.stringify(source));
  await assert.rejects(checkMap(output), /provenance/i);
});

test('rejects oversized responses and invalid UTF-8 without changing the snapshot', async t => {
  const output = await directory(t);
  const bytes = JSON.stringify(fixture());
  await updateMap({ directory: output, fetchImpl: responder(bytes) });
  await assert.rejects(updateMap({ directory: output, fetchImpl: responder(' '.repeat(1_048_577)) }), /1 MiB/i);
  await assert.rejects(updateMap({ directory: output, fetchImpl: responder(Buffer.from([0xff])) }), /encoded|encoding/i);
  assert.equal(await readFile(path.join(output, 'repos.json'), 'utf8'), bytes);
});

test('accepts a new ownership group and its repository without a docs code change', () => {
  const data = fixture();
  data.groups.push({ id: 'operations', title: 'Operations', blurb: 'Running the organisation services.' });
  data.repos.push({ ...structuredClone(data.repos[0]), name: 'operations', group: 'operations', status: 'proposed' });
  assert.equal(validateMap(data).groups.length, 5);
  assert.equal(data.repos[2].group, 'operations');
});

test('rejects a map with no ownership groups', () => {
  const data = fixture(); data.groups = [];
  assert.throws(() => validateMap(data), /group/i);
});
