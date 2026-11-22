import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { selectRelease, resolveRelease, updateBrand } from '../scripts/update-brand.mjs';

const oldCommit = '8c998a2990ae477daf5ac1636028f6cbf379577b';
const nextCommit = '1234567890abcdef1234567890abcdef12345678';
const tagObject = 'abcdef1234567890abcdef1234567890abcdef12';
const oldUrl = `https://github.com/unset-sh/brand/archive/${oldCommit}.tar.gz`;
const nextUrl = `https://github.com/unset-sh/brand/archive/${nextCommit}.tar.gz`;
const integrity = `sha512-${Buffer.alloc(64, 1).toString('base64')}`;
const release = (tag, extra = {}) => ({ tag_name: tag, draft: false, prerelease: false,
  published_at: '2026-11-22T07:00:00Z', ...extra });

function api(routes) {
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    if (url === 'https://docs.unset.sh/_brand/provenance.json') {
      const data = routes.provenance ?? new Response('', { status: 404 });
      return data instanceof Response ? data : Response.json(data);
    }
    const prefix = 'https://api.github.com/repos/unset-sh/brand/';
    assert.ok(url.startsWith(prefix), `Unexpected API owner or host: ${url}`);
    const route = url.slice(prefix.length);
    assert.ok(Object.hasOwn(routes, route), `Unexpected API route: ${route}`);
    const data = routes[route];
    return data instanceof Response ? data : Response.json(data);
  };
}

function released(version = '0.1.2', commit = nextCommit, provenance) {
  return api({
    provenance,
    'releases?per_page=100&page=1': [release(`v${version}`, { tarball_url: 'https://example.invalid/payload' })],
    [`git/ref/tags/v${version}`]: { ref: `refs/tags/v${version}`, object: { type: 'commit', sha: commit } },
  });
}

test('selects the highest numeric stable patch and excludes future minor, drafts and prereleases', () => {
  assert.equal(selectRelease([
    release('v0.1.9'), release('v0.1.10'), release('v0.2.0'), release('v1.0.0'),
    release('v0.1.11-rc.1'), release('v0.1.12', { draft: true }),
    release('v0.1.13', { prerelease: true }), release('v0.1.14', { published_at: null }),
    release('v0.1.0'),
  ], '0.1.1')?.tag_name, 'v0.1.10');
});

test('fails closed if pagination never terminates', async () => {
  await assert.rejects(resolveRelease({ fetchImpl: async () => Response.json(
    Array.from({ length: 100 }, (_, i) => release(`v0.2.${i}`)),
  ) }), /pagination/i);
});

test('never selects a downgrade or a version older than the migration baseline', () => {
  assert.equal(selectRelease([release('v0.1.0')], '0.1.1'), null);
  assert.equal(selectRelease([release('v0.1.1')], '0.1.2'), null);
  assert.throws(() => selectRelease([], '0.2.0'), /version|baseline/i);
});

test('rejects malformed release metadata instead of treating missing flags as stable', () => {
  for (const entry of [null, { tag_name: 'v0.1.2' }, release('v0.1.2', { published_at: 'invalid' })]) {
    assert.throws(() => selectRelease([entry], '0.1.1'), /release|metadata/i);
  }
});

test('pages through releases and resolves an annotated tag to a fixed commit archive', async () => {
  const result = await resolveRelease({ fetchImpl: api({
    'releases?per_page=100&page=1': Array.from({ length: 100 }, (_, i) => release(`v0.2.${i}`)),
    'releases?per_page=100&page=2': [release('v0.1.10')],
    'git/ref/tags/v0.1.10': { ref: 'refs/tags/v0.1.10', object: { type: 'tag', sha: tagObject } },
    [`git/tags/${tagObject}`]: { sha: tagObject, tag: 'v0.1.10', object: { type: 'commit', sha: nextCommit } },
  }), currentVersion: '0.1.1' });
  assert.deepEqual(result, { version: '0.1.10', tag: 'v0.1.10', commit: nextCommit, url: nextUrl });
});

test('ignores payload download URLs and only constructs the fixed repository archive URL', async () => {
  assert.deepEqual(await resolveRelease({ fetchImpl: released() }),
    { version: '0.1.2', tag: 'v0.1.2', commit: nextCommit, url: nextUrl });
});

test('fails closed on HTTP failures, malformed responses and tag mismatches', async (t) => {
  const cases = [
    ['API failure', { 'releases?per_page=100&page=1': new Response('', { status: 403 }) }, /HTTP 403/i],
    ['invalid JSON', { 'releases?per_page=100&page=1': new Response('{') }, /JSON/i],
    ['non-array releases', { 'releases?per_page=100&page=1': {} }, /release/i],
    ['wrong reference', { 'git/ref/tags/v0.1.2': { ref: 'refs/tags/v0.1.3', object: { type: 'commit', sha: nextCommit } } }, /tag|reference/i],
    ['malformed SHA', { 'git/ref/tags/v0.1.2': { ref: 'refs/tags/v0.1.2', object: { type: 'commit', sha: '../main' } } }, /SHA|commit/i],
    ['wrong annotated tag', {
      'git/ref/tags/v0.1.2': { ref: 'refs/tags/v0.1.2', object: { type: 'tag', sha: tagObject } },
      [`git/tags/${tagObject}`]: { sha: tagObject, tag: 'v0.1.3', object: { type: 'commit', sha: nextCommit } },
    }, /tag/i],
    ['wrong tag object SHA', {
      'git/ref/tags/v0.1.2': { ref: 'refs/tags/v0.1.2', object: { type: 'tag', sha: tagObject } },
      [`git/tags/${tagObject}`]: { sha: nextCommit, tag: 'v0.1.2', object: { type: 'commit', sha: nextCommit } },
    }, /SHA|tag/i],
  ];
  for (const [name, overrides, expected] of cases) await t.test(name, async () => {
    await assert.rejects(resolveRelease({ fetchImpl: api({
      'releases?per_page=100&page=1': [release('v0.1.2')], ...overrides,
    }) }), expected);
  });
});

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'docs-brand-release-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pkg = { name: 'unset-docs', devDependencies: { '@unset-sh/brand': oldUrl, yaml: '2.9.1' } };
  const lock = { name: 'unset-docs', lockfileVersion: 3, requires: true, packages: {
    '': structuredClone(pkg),
    'node_modules/@unset-sh/brand': { version: '0.1.1', resolved: oldUrl, integrity, dev: true },
    'node_modules/yaml': { version: '2.9.1', resolved: 'https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz', integrity },
  } };
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  await writeFile(path.join(directory, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
  const original = await Promise.all(['package.json', 'package-lock.json'].map(name => readFile(path.join(directory, name))));
  const read = async name => JSON.parse(await readFile(path.join(directory, name)));
  const unchanged = async () => {
    for (const [i, name] of ['package.json', 'package-lock.json'].entries()) {
      assert.deepEqual(await readFile(path.join(directory, name)), original[i]);
    }
  };
  const runNpm = async (args, { cwd }) => {
    assert.equal(cwd, directory);
    assert.deepEqual(args, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund']);
    const current = await read('package.json');
    const nextLock = structuredClone(lock);
    nextLock.packages[''].devDependencies = current.devDependencies;
    nextLock.packages['node_modules/@unset-sh/brand'] = { version: '0.1.2', resolved: nextUrl, integrity, dev: true };
    await writeFile(path.join(directory, 'package-lock.json'), JSON.stringify(nextLock));
  };
  return { directory, lock, read, unchanged, runNpm };
}

test('updates only the brand archive and lock after resolving a published compatible release', async (t) => {
  const f = await fixture(t);
  const messages = [];
  const result = await updateBrand({ ...f, fetchImpl: released(), report: text => messages.push(text) });
  assert.equal(result.status, 'updated');
  assert.equal(result.version, '0.1.2');
  assert.deepEqual((await f.read('package.json')).devDependencies, { '@unset-sh/brand': nextUrl, yaml: '2.9.1' });
  assert.equal((await f.read('package-lock.json')).packages['node_modules/@unset-sh/brand'].resolved, nextUrl);
  assert.match(messages.join('\n'), /0\.1\.2/);
  assert.match(messages.join('\n'), new RegExp(nextCommit));
});

test('reports baseline retention without using unpublished tags or running npm', async (t) => {
  const f = await fixture(t);
  const messages = [];
  const result = await updateBrand({ ...f, fetchImpl: api({ 'releases?per_page=100&page=1': [] }),
    runNpm: () => assert.fail('No release must not run npm'), report: text => messages.push(text) });
  assert.equal(result.status, 'fallback');
  assert.match(messages.join('\n'), /no published compatible release.*0\.1\.1/i);
  await f.unchanged();
});

test('leaves an already pinned release untouched and refuses a moved same-version tag', async (t) => {
  const f = await fixture(t);
  const options = { ...f, runNpm: () => assert.fail('Same version must not run npm'), report: () => {} };
  assert.equal((await updateBrand({ ...options, fetchImpl: released('0.1.1', oldCommit) })).status, 'unchanged');
  await assert.rejects(updateBrand({ ...options, fetchImpl: released('0.1.1') }), /moved|same.version/i);
  await f.unchanged();
});

test('restores package files on npm failure or wrong downloaded release metadata', async (t) => {
  for (const kind of ['npm failure', 'wrong version', 'wrong URL', 'invalid integrity', 'unrelated dependency']) await t.test(kind, async (t) => {
    const f = await fixture(t);
    const runNpm = async (...args) => {
      await f.runNpm(...args);
      if (kind === 'npm failure') throw new Error('npm failed');
      const lock = await f.read('package-lock.json');
      const brand = lock.packages['node_modules/@unset-sh/brand'];
      if (kind === 'wrong version') brand.version = '0.1.1';
      if (kind === 'wrong URL') brand.resolved = 'https://example.invalid/payload';
      if (kind === 'invalid integrity') brand.integrity = 'sha512-invalid';
      if (kind === 'unrelated dependency') lock.packages['node_modules/extra'] = { version: '1.0.0' };
      await writeFile(path.join(f.directory, 'package-lock.json'), JSON.stringify(lock));
    };
    await assert.rejects(updateBrand({ ...f, runNpm, fetchImpl: released(), report: () => {} }), /npm|version|URL|integrity|dependency/i);
    await f.unchanged();
  });
});

test('rejects a current lock without a release version before using a fallback', async (t) => {
  const f = await fixture(t);
  delete f.lock.packages['node_modules/@unset-sh/brand'].version;
  await writeFile(path.join(f.directory, 'package-lock.json'), JSON.stringify(f.lock));
  await assert.rejects(updateBrand({ ...f, fetchImpl: api({ 'releases?per_page=100&page=1': [] }), report: () => {} }), /version/i);
});

const deployed = (version = '0.1.2', resolved = nextUrl, checksum = integrity) => ({
  version, installation: { version, resolved, integrity: checksum },
});

test('refuses withdrawal of the deployed release instead of downgrading to the checkout baseline', async (t) => {
  const f = await fixture(t);
  await assert.rejects(updateBrand({ ...f, fetchImpl: released('0.1.1', oldCommit, deployed()), report: () => {} }), /deployed.*release|release.*deployed/i);
  await f.unchanged();
});

test('refuses a moved deployed tag even when it is newer than the checkout baseline', async (t) => {
  const f = await fixture(t);
  await assert.rejects(updateBrand({ ...f, fetchImpl: released('0.1.2', oldCommit, deployed()), report: () => {} }), /deployed.*commit|moved/i);
  await f.unchanged();
});

test('checks deployed archive integrity after refreshing an older checkout', async (t) => {
  const f = await fixture(t);
  const differentIntegrity = `sha512-${Buffer.alloc(64, 2).toString('base64')}`;
  await assert.rejects(updateBrand({ ...f, fetchImpl: released('0.1.2', nextCommit, deployed('0.1.2', nextUrl, differentIntegrity)), report: () => {} }), /deployed.*integrity|integrity.*deployed/i);
  await f.unchanged();
});

test('adopts the deployed release from an older checkout only when commit and integrity agree', async (t) => {
  const f = await fixture(t);
  const result = await updateBrand({ ...f, fetchImpl: released('0.1.2', nextCommit, deployed()), report: () => {} });
  assert.equal(result.status, 'updated');
  assert.equal(result.version, '0.1.2');
});

test('fails closed on live provenance HTTP errors and malformed metadata', async (t) => {
  const cases = [
    ['HTTP failure', new Response('', { status: 503 })],
    ['invalid JSON', new Response('{')],
    ['missing installation', { version: '0.1.2' }],
    ['wrong version', deployed('0.2.0')],
    ['wrong repository', deployed('0.1.2', 'https://example.invalid/brand.tar.gz')],
    ['invalid integrity', deployed('0.1.2', nextUrl, 'sha512-invalid')],
    ['version mismatch', { ...deployed(), version: '0.1.1' }],
  ];
  for (const [name, provenance] of cases) await t.test(name, async (t) => {
    const f = await fixture(t);
    await assert.rejects(updateBrand({ ...f, fetchImpl: released('0.1.2', nextCommit, provenance), report: () => {} }), /provenance|deployed/i);
    await f.unchanged();
  });
});
