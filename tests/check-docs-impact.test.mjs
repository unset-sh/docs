import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { evaluateImpact, changedPaths, checkDocsImpact, parseInput } from '../scripts/check-docs-impact.mjs';

const exec = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/check-docs-impact.mjs', import.meta.url));
const sha = '1234567890abcdef1234567890abcdef12345678';
const policy = {
  schemaVersion: 1,
  exclude: [{ prefix: 'tests/' }, { prefix: 'vendor/' }],
  documentation: [{ prefix: 'docs/' }, { exact: 'README.md' }],
  rules: [
    { id: 'api', source: [{ prefix: 'src/api/' }], docs: [{ exact: 'docs/api.md' }] },
    { id: 'build', source: [{ exact: 'build.mjs' }], docs: [{ exact: 'README.md' }] },
  ],
  fallback: { id: 'new-area', docs: [{ exact: 'README.md' }] },
};

test('a source change requires relevant documentation, not an unrelated page', () => {
  assert.equal(evaluateImpact(['src/api/read.mjs'], policy).ok, false);
  assert.equal(evaluateImpact(['src/api/read.mjs', 'docs/other.md'], policy).ok, false);
  assert.equal(evaluateImpact(['src/api/read.mjs', 'docs/api.md'], policy).ok, true);
});

test('directory and exact matchers do not accidentally match sibling names', () => {
  assert.deepEqual(evaluateImpact(['src/apiculture/read.mjs'], policy).missing.map(rule => rule.id), ['new-area']);
  assert.deepEqual(evaluateImpact(['build.mjs.old'], policy).missing.map(rule => rule.id), ['new-area']);
  assert.deepEqual(evaluateImpact(['build.mjs'], policy).missing.map(rule => rule.id), ['build']);
});

test('unmapped source areas use the fallback and tests-only changes need no prose', () => {
  assert.equal(evaluateImpact(['new-feature/main.mjs'], policy).ok, false);
  assert.equal(evaluateImpact(['new-feature/main.mjs', 'README.md'], policy).ok, true);
  assert.equal(evaluateImpact(['tests/api.test.mjs', 'vendor/library.js'], policy).ok, true);
  assert.equal(evaluateImpact(['docs/api.md'], policy).ok, true);
});

test('each affected rule needs its own relevant documentation', () => {
  const result = evaluateImpact(['src/api/read.mjs', 'build.mjs', 'docs/api.md'], policy);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing.map(rule => rule.id), ['build']);
});

test('an explicit substantive PR-body reason can account for missing documentation changes', () => {
  const reason = 'Internal function names changed; the public API and examples stay the same.';
  const result = evaluateImpact(['src/api/read.mjs'], policy, `Summary\n\nDocs impact: no update needed — ${reason}\n`);
  assert.equal(result.ok, true);
  assert.equal(result.reason, reason);
});

test('quoted examples, placeholders and duplicate reason lines cannot silently waive the check', () => {
  const marker = 'Docs impact: no update needed — Internal names changed without altering public behaviour.';
  for (const body of [`\`\`\`text\n${marker}\n\`\`\``, `> ${marker}`, `<!--\n${marker}\n-->`]) {
    assert.equal(evaluateImpact(['src/api/read.mjs'], policy, body).ok, false);
  }
  for (const body of ['Docs impact: no update needed — n/a', `${marker}\n${marker}`]) {
    assert.throws(() => evaluateImpact(['src/api/read.mjs'], policy, body), /reason|single/i);
  }
});

test('invalid policies fail instead of silently widening a path rule', () => {
  for (const mutate of [
    p => { p.rules[0].source = [{ prefix: 'src/api' }]; },
    p => { p.rules[0].source = [{ exact: '../outside' }]; },
    p => { p.rules[0].source = [{ exact: 'src/api', prefix: 'src/' }]; },
    p => { p.fallback.docs = []; },
    p => { p.rules[1].id = 'api'; },
  ]) {
    const invalid = structuredClone(policy);
    mutate(invalid);
    assert.throws(() => evaluateImpact(['src/api/read.mjs'], invalid), /policy|path|prefix|matcher|rule/i);
  }
});

test('input requires complete hexadecimal commits and never accepts shell or git arguments as revisions', () => {
  for (const value of ['main', '--output=/tmp/file', `${sha};touch /tmp/file`, `${sha}\n`, 'a'.repeat(39)]) {
    assert.throws(() => parseInput(['--base', value, '--head', sha], {}), /SHA|commit|argument/i);
  }
  assert.throws(() => parseInput(['--base', sha], {}), /base|head/i);
  assert.throws(() => parseInput(['--base', sha, '--head', sha, '--body', 'reason'], {}), /argument|option/i);
});

const gitEnv = {
  ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0',
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};

async function fixture(t) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'docs-impact-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const git = async (...args) => (await exec('git', args, { cwd, env: gitEnv })).stdout.trim();
  const write = async (name, data) => {
    await mkdir(path.dirname(path.join(cwd, name)), { recursive: true });
    await writeFile(path.join(cwd, name), data);
  };
  const commit = async () => {
    await git('add', '--all');
    await git('-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  await git('init', '-q');
  await write('src/api/read.mjs', 'export const value = 1;\n');
  await write('docs/api.md', 'API explanation.\n');
  await write('docs/other.md', 'Other explanation.\n');
  await write('.github/docs-impact.json', JSON.stringify(policy));
  const base = await commit();
  return { cwd, git, write, commit, base };
}

test('git diff includes deleted source and both sides of a rename', async (t) => {
  for (const kind of ['delete', 'rename']) await t.test(kind, async (t) => {
    const f = await fixture(t);
    if (kind === 'delete') await rm(path.join(f.cwd, 'src/api/read.mjs'));
    else await rename(path.join(f.cwd, 'src/api/read.mjs'), path.join(f.cwd, 'src/api/new name.mjs'));
    const head = await f.commit();
    const files = await changedPaths({ cwd: f.cwd, base: f.base, head });
    assert.ok(files.includes('src/api/read.mjs'));
    if (kind === 'rename') assert.ok(files.includes('src/api/new name.mjs'));
    assert.equal(evaluateImpact(files, policy).ok, false);
  });
});

test('the CLI uses NUL-delimited file names and exits nonzero for undocumented source changes', async (t) => {
  const f = await fixture(t);
  await f.write('src/api/a\nsecond-name.mjs', 'export const value = 2;\n');
  const head = await f.commit();
  const files = await changedPaths({ cwd: f.cwd, base: f.base, head });
  assert.deepEqual(files, ['src/api/a\nsecond-name.mjs']);
  await assert.rejects(exec(process.execPath, [script, '--base', f.base, '--head', head],
    { cwd: f.cwd, env: { ...gitEnv, GITHUB_EVENT_PATH: '', GITHUB_EVENT_NAME: '' } }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /api|documentation/i);
    return true;
  });
});

test('the waiver comes only from the current PR event, never a saved artifact or different revision', async (t) => {
  const f = await fixture(t);
  const marker = 'Docs impact: no update needed — Internal names changed; $(touch executed-body) is only literal text.';
  await f.write('src/api/read.mjs', 'export const value = 2;\n');
  await f.write('tests/previous-pr.md', marker);
  const head = await f.commit();
  await assert.rejects(checkDocsImpact({ cwd: f.cwd, args: ['--base', f.base, '--head', head], env: {}, report: () => {} }), /documentation/i);
  const eventFile = path.join(f.cwd, 'event.json');
  const event = { pull_request: { base: { sha: f.base }, head: { sha: head }, body: marker } };
  await writeFile(eventFile, JSON.stringify(event));
  const env = { GITHUB_EVENT_PATH: eventFile, GITHUB_EVENT_NAME: 'pull_request' };
  assert.equal((await checkDocsImpact({ cwd: f.cwd, args: [], env, report: () => {} })).ok, true);
  await assert.rejects(checkDocsImpact({ cwd: f.cwd, args: ['--base', f.base, '--head', f.base], env, report: () => {} }), /event|revision/i);
  await writeFile(eventFile, JSON.stringify({ ...event, pull_request: { ...event.pull_request, body: null } }));
  await assert.rejects(checkDocsImpact({ cwd: f.cwd, args: [], env, report: () => {} }), /documentation/i);
  await assert.rejects(access(path.join(f.cwd, 'executed-body')));
});

test('a malformed PR SHA fails before invoking git or evaluating PR text', async (t) => {
  const f = await fixture(t);
  const eventFile = path.join(f.cwd, 'event.json');
  await writeFile(eventFile, JSON.stringify({ pull_request: {
    base: { sha: '--output=executed-body' }, head: { sha }, body: '$(touch executed-body)',
  } }));
  await assert.rejects(checkDocsImpact({ cwd: f.cwd, args: [], env: { GITHUB_EVENT_PATH: eventFile }, report: () => {} }), /SHA|commit/i);
  await assert.rejects(access(path.join(f.cwd, 'executed-body')));
});

test('root policy covers framework changes and exempts tests and generated assets', async () => {
  const rootPolicy = JSON.parse(await readFile(new URL('../.github/docs-impact.json', import.meta.url)));
  assert.equal(evaluateImpact(['scripts/build.sh'], rootPolicy).ok, false);
  assert.equal(evaluateImpact(['scripts/build.sh', 'README.md'], rootPolicy).ok, true);
  assert.equal(evaluateImpact(['scripts/build.sh', 'content/updates.md'], rootPolicy).ok, true);
  assert.equal(evaluateImpact(['.github/workflows/site.yml', 'content/updates.md'], rootPolicy).ok, true);
  assert.equal(evaluateImpact(['layouts/home.html', '.github/CONTRIBUTING.md'], rootPolicy).ok, true);
  assert.equal(evaluateImpact(['tests/prepare.test.mjs', 'assets/js/vendor/flexsearch.bundle.min.js'], rootPolicy).ok, true);
  assert.equal(evaluateImpact(['scripts/update-map.mjs', 'README.md'], rootPolicy).ok, false);
  assert.equal(evaluateImpact(['scripts/update-map.mjs', 'content/organisation.md'], rootPolicy).ok, true);
  assert.equal(evaluateImpact(['data/org-map/repos.json', 'data/org-map/source.json'], rootPolicy).ok, true);
  assert.equal(evaluateImpact(['data/org-map/repos.json.backup'], rootPolicy).ok, false);
});

test('root policy counts imported and hand-copied sections as documentation', async () => {
  const rootPolicy = JSON.parse(await readFile(new URL('../.github/docs-impact.json', import.meta.url)));
  for (const section of ['tooling', 'github', 'brand', 'rendering', 'lexicons', 'agent-kit', 'web', 'backend', 'deployment', 'pds', 'modules', 'profile-recipes']) {
    assert.equal(evaluateImpact([`${section}/_index.md`, `${section}/source.json`, `${section}/LICENSE`], rootPolicy).ok, true);
  }
  assert.equal(evaluateImpact(['tooling-extra/page.md'], rootPolicy).ok, false);
  assert.equal(evaluateImpact(['tooling/_index.md', 'scripts/build.sh'], rootPolicy).ok, false);
});
