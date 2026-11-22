import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { prepare } from '../scripts/prepare.mjs';

async function put(root, path, contents = 'page') {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), contents);
}

async function fixture(t, files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'unset-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, contents] of Object.entries({
    'content/_index.md': 'homepage',
    '.build/content/old.md': 'keep until validation passes',
    ...files,
  })) {
    const section = /^[a-z0-9-]+\/_index\.md$/.test(path) && !path.startsWith('content/');
    await put(root, path, section ? `---\ntitle: Example\ntype: docs\ncascade:\n  type: docs\nmenus:\n  main:\n    weight: 10\n---\n${contents}` : contents);
  }
  return root;
}

async function refuses(root, pattern, options) {
  await assert.rejects(prepare(root, options), pattern);
  assert.equal(await readFile(join(root, '.build/content/old.md'), 'utf8'),
    'keep until validation passes');
}

test('discovers two repository sections and stages their pages with the homepage', async (t) => {
  const root = await fixture(t, {
    'profile-recipes/_index.md': 'recipes',
    'lexicons/_index.md': 'lexicons',
    'lexicons/records/page.md': 'a record',
    'lexicons/records/image.svg': '<svg/>',
    'unset/human/private.md': 'app documentation',
    'layouts/page.html': 'template',
    '.github/workflows/ci.yml': 'workflow',
  });
  assert.deepEqual(await prepare(root), ['lexicons', 'profile-recipes']);
  assert.deepEqual((await readdir(join(root, '.build/content'))).sort(),
    ['_index.md', 'lexicons', 'profile-recipes']);
  assert.equal(await readFile(join(root, '.build/content/lexicons/records/page.md'), 'utf8'), 'a record');
  assert.equal(await readFile(join(root, '.build/content/lexicons/records/image.svg'), 'utf8'), '<svg/>');
  assert.equal(await readFile(join(root, '.build/content/_index.md'), 'utf8'), 'homepage');
});

test('removes pages from a section that no longer exists', async (t) => {
  const root = await fixture(t, { 'lexicons/_index.md': 'lexicons' });
  await prepare(root);
  await rm(join(root, 'lexicons'), { recursive: true });
  assert.deepEqual(await prepare(root), []);
  assert.deepEqual(await readdir(join(root, '.build/content')), ['_index.md']);
});

test('refuses a source section that clashes with root content', async (t) => {
  const root = await fixture(t, { 'lexicons/_index.md': 'source', 'content/lexicons/_index.md': 'clash' });
  await refuses(root, /clash/i);
});

for (const extension of ['md', 'markdown', 'mdown', 'html', 'htm']) {
  test(`refuses a source section that clashes with a root ${extension} page`, async (t) => {
    const root = await fixture(t, { 'organisation/_index.md': 'source', [`content/organisation.${extension}`]: 'framework page' });
    await refuses(root, /clash/i);
  });
}

test('refuses a source folder without an index', async (t) => {
  const root = await fixture(t, { 'lexicons/page.md': 'page' });
  await refuses(root, /_index\.md/);
});

for (const [field, valid, invalid] of [
  ['title', 'title: Example', 'title: ""'],
  ['type', 'type: docs', 'type: blog'],
  ['cascade', 'cascade:\n  type: docs', 'cascade:\n  type: blog'],
  ['menu weight', 'weight: 10', 'weight: later'],
]) {
  test(`refuses a source section with invalid ${field} before staging`, async (t) => {
    const root = await fixture(t, { 'lexicons/_index.md': 'section' });
    const file = join(root, 'lexicons/_index.md');
    await writeFile(file, (await readFile(file, 'utf8')).replace(valid, invalid));
    await refuses(root, /section front matter/i);
  });
}

test('refuses a section without YAML front matter before staging', async (t) => {
  const root = await fixture(t, { 'lexicons/_index.md': 'section' });
  await writeFile(join(root, 'lexicons/_index.md'), 'a plain page');
  await refuses(root, /section front matter/i);
});

test('refuses a directory used as a source index', async (t) => {
  const root = await fixture(t, { 'lexicons/_index.md/nested.md': 'not an index' });
  await refuses(root, /_index\.md/);
});

test('refuses an unsafe source folder name', async (t) => {
  const root = await fixture(t, { 'Bad_Name/_index.md': 'page' });
  await refuses(root, /name/i);
});

test('refuses an index at the top of a reserved framework folder', async (t) => {
  const root = await fixture(t, { 'assets/_index.md': 'not a section' });
  await refuses(root, /reserved/i);
});

for (const path of ['lexicons/linked.md', '.hidden/linked', 'assets/link', 'unset/link', 'broken']) {
  test(`refuses a symlink at ${path} before staging`, async (t) => {
    const root = await fixture(t, { 'lexicons/_index.md': 'section' });
    await mkdir(dirname(join(root, path)), { recursive: true });
    await symlink(path === 'broken' ? 'missing-target' : join(root, 'content'), join(root, path));
    await refuses(root, /symbolic|symlink/i);
  });
}

for (const name of ['node_modules', '.build', 'public', 'resources']) {
  test(`refuses a symlink used as the root ${name} output directory`, async (t) => {
    const root = await fixture(t);
    const outside = await mkdtemp(join(tmpdir(), 'unset-docs-output-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    await put(outside, 'untouched', 'outside');
    await rm(join(root, name), { recursive: true, force: true });
    await symlink(outside, join(root, name));
    await assert.rejects(prepare(root), /symbolic|symlink/i);
    assert.equal(await readFile(join(outside, 'untouched'), 'utf8'), 'outside');
  });
}

test('refuses a hardlink in a hidden source folder', async (t) => {
  const root = await fixture(t);
  await mkdir(join(root, '.hidden'));
  await link(join(root, 'content/_index.md'), join(root, '.hidden/copy'));
  await refuses(root, /hardlink|hard link/i);
});

test('refuses a FIFO without trying to read it', async (t) => {
  const root = await fixture(t);
  execFileSync('mkfifo', [join(root, 'pipe')]);
  await refuses(root, /regular|special/i);
});

test('ignores git metadata and generated directory contents', async (t) => {
  const root = await fixture(t);
  for (const name of ['.git', 'node_modules', '.build', 'public', 'resources']) {
    await mkdir(join(root, name), { recursive: true });
    await symlink('missing-target', join(root, name, 'ignored-link'));
  }
  assert.deepEqual(await prepare(root), []);
});

test('allows git worktree metadata as a regular file', async (t) => {
  const root = await fixture(t, { '.git': 'gitdir: elsewhere' });
  assert.deepEqual(await prepare(root), []);
});

test('refuses publishing while the legacy app folder remains', async (t) => {
  const root = await fixture(t, { 'lexicons/_index.md': 'section', 'unset/old.md': 'app' });
  await refuses(root, /unset/, { publish: true });
});

test('refuses publishing without a source section', async (t) => {
  const root = await fixture(t);
  await refuses(root, /section/i, { publish: true });
});

test('allows publishing after a source arrives and the legacy app folder leaves', async (t) => {
  const root = await fixture(t, { 'lexicons/_index.md': 'section' });
  assert.deepEqual(await prepare(root, { publish: true }), ['lexicons']);
});

test('CLI honors --publish and rejects unknown arguments', async (t) => {
  const root = await fixture(t);
  const script = new URL('../scripts/prepare.mjs', import.meta.url);
  for (const argument of ['--publish', '--unknown']) {
    assert.throws(() => execFileSync(process.execPath, [script.pathname, argument], {
      cwd: root, stdio: 'pipe',
    }), { status: 1 });
  }
  const section = '---\ntitle: Lexicons\ntype: docs\ncascade:\n  type: docs\nmenus:\n  main:\n    weight: 10\n---\nsection';
  await put(root, 'lexicons/_index.md', section);
  execFileSync(process.execPath, [script.pathname, '--publish'], { cwd: root, stdio: 'pipe' });
  assert.equal(await readFile(join(root, '.build/content/lexicons/_index.md'), 'utf8'), section);
  const json = execFileSync(process.execPath, [script.pathname, '--publish', '--json'], {
    cwd: root, encoding: 'utf8', stdio: 'pipe',
  });
  assert.deepEqual(JSON.parse(json), ['lexicons']);
});
