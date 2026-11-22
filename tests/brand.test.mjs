import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareBrand, writeInstallationProvenance, verifyTokenUsage } from '../scripts/brand.mjs';

const firstCss = '@font-face {font-family:"First Sans";src:url("../fonts/first.woff2");}\n'
  + ':root {--font-sans:"First Sans",sans-serif;--ink:#ededed;--link:var(--ink);}\n'
  + ':root[data-theme="light"] {--ink:#171717;}\n';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'docs-brand-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageDir = path.join(root, 'package');
  const outputDir = path.join(root, 'output');
  const files = {
    'dist/tokens.css': firstCss,
    'dist/recipes.css': '.brand-button {color:var(--ink);}',
    'dist/contract.json': JSON.stringify({ schemaVersion: 1, id: 'unset.brand', version: '0.1.0' }),
    'dist/resolved.json': JSON.stringify({ version: '0.1.0', themes: { light: { 'color.ink': '#171717' } } }),
    'dist/meta.json': JSON.stringify({ version: '0.1.0', defaultTheme: 'dark' }),
    'fonts/first.woff2': 'first font bytes',
    'fonts/OFL.txt': 'font licence',
    'logo/mark.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'icons/favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'icons/tabler/icons.json': JSON.stringify({ family: 'Tabler Icons', drawings: { search: [['circle', { r: '7' }]] } }),
    'icons/tabler/icon-map.json': JSON.stringify({ search: 'search' }),
    'icons/tabler/LICENSE.md': 'icon licence',
  };
  async function save() {
    await mkdir(packageDir, { recursive: true });
    for (const [name, data] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(packageDir, name)), { recursive: true });
      await writeFile(path.join(packageDir, name), data);
    }
    const manifest = { schemaVersion: 2, version: '0.1.0', authority: 'src/contract.json', files: Object.entries(files).map(([name, data]) => ({
      path: name, sha256: createHash('sha256').update(data).digest('hex'), origin: 'repository-build',
    })) };
    await writeFile(path.join(packageDir, 'source.json'), JSON.stringify(manifest));
    await writeFile(path.join(packageDir, 'dist/source.json'), JSON.stringify(manifest));
    await writeFile(path.join(packageDir, 'package.json'), JSON.stringify({ name: '@unset-sh/brand', version: '0.1.0' }));
    await writeFile(path.join(packageDir, 'LICENSE'), 'package licence');
    await writeFile(path.join(packageDir, 'LICENSE-ASSETS.md'), 'asset licence');
    await writeFile(path.join(packageDir, 'THIRD-PARTY-NOTICES.md'), 'third party notices');
  }
  await save();
  return { packageDir, outputDir, files, save };
}

test('publishes schema 2 CSS unchanged with relative font paths and verified Hugo data', async (t) => {
  const f = await fixture(t);
  await prepareBrand(f.packageDir, f.outputDir);
  const target = path.join(f.outputDir, 'static/_brand');
  assert.equal(await readFile(path.join(target, 'dist/tokens.css'), 'utf8'), firstCss);
  assert.equal(await readFile(path.join(target, 'fonts/first.woff2'), 'utf8'), 'first font bytes');
  for (const [file, expected] of [
    ['fonts/OFL.txt', 'font licence'], ['LICENSE', 'package licence'],
    ['LICENSE-ASSETS.md', 'asset licence'], ['THIRD-PARTY-NOTICES.md', 'third party notices'],
    ['icons/tabler/LICENSE.md', 'icon licence'], ['dist/recipes.css', '.brand-button {color:var(--ink);}'],
  ]) assert.equal(await readFile(path.join(target, file), 'utf8'), expected);
  for (const [name, source] of [
    ['contract', 'dist/contract.json'], ['resolved', 'dist/resolved.json'], ['meta', 'dist/meta.json'],
    ['icons', 'icons/tabler/icons.json'], ['iconMap', 'icons/tabler/icon-map.json'],
  ]) assert.equal(await readFile(path.join(f.outputDir, `data/brand/${name}.json`), 'utf8'), f.files[source]);
  const sourceBytes = await readFile(path.join(f.packageDir, 'source.json'));
  assert.deepEqual(await readFile(path.join(f.outputDir, 'source.json')), sourceBytes);
  assert.deepEqual(await readFile(path.join(target, 'dist/source.json')), sourceBytes);
  const report = JSON.parse(await readFile(path.join(f.outputDir, 'provenance.json')));
  assert.equal(report.name, '@unset-sh/brand');
  assert.equal(report.version, '0.1.0');
  assert.equal(report.sourceSha256, createHash('sha256').update(sourceBytes).digest('hex'));
  assert.equal(report.files.find((file) => file.path === 'fonts/first.woff2').sha256,
    JSON.parse(sourceBytes).files.find((file) => file.path === 'fonts/first.woff2').sha256);
  await assert.rejects(readFile(path.join(f.outputDir, 'assets/css/brand.css')), { code: 'ENOENT' });
});

test('package CSS and font changes take effect without a site edit and remove obsolete output', async (t) => {
  const f = await fixture(t);
  await prepareBrand(f.packageDir, f.outputDir);
  await mkdir(path.join(f.outputDir, 'assets/css'), { recursive: true });
  await mkdir(path.join(f.outputDir, 'static/brand'), { recursive: true });
  await writeFile(path.join(f.outputDir, 'static/brand/obsolete.css'), 'old namespace');
  await writeFile(path.join(f.outputDir, 'assets/css/brand.css'), 'obsolete schema 1 generated CSS');
  f.files['dist/tokens.css'] = '@font-face {font-family:"Next Sans";src:url("../fonts/next.woff2");}\n'
    + ':root {--font-sans:"Next Sans",sans-serif;--ink:#e0e0e0;--link:var(--ink);}\n';
  delete f.files['fonts/first.woff2'];
  await rm(path.join(f.packageDir, 'fonts/first.woff2'));
  f.files['fonts/next.woff2'] = 'next font bytes';
  await f.save();
  await prepareBrand(f.packageDir, f.outputDir);
  const target = path.join(f.outputDir, 'static/_brand');
  assert.equal(await readFile(path.join(target, 'dist/tokens.css'), 'utf8'), f.files['dist/tokens.css']);
  assert.equal(await readFile(path.join(target, 'fonts/next.woff2'), 'utf8'), 'next font bytes');
  await assert.rejects(readFile(path.join(target, 'fonts/first.woff2')), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(f.outputDir, 'assets/css/brand.css')), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(f.outputDir, 'static/brand/obsolete.css')), { code: 'ENOENT' });
});

test('rejects the old published schema with a useful upgrade error', async (t) => {
  const f = await fixture(t);
  const source = JSON.parse(await readFile(path.join(f.packageDir, 'source.json')));
  delete source.schemaVersion;
  await writeFile(path.join(f.packageDir, 'source.json'), JSON.stringify(source));
  await assert.rejects(prepareBrand(f.packageDir, f.outputDir), /schemaVersion 2.*snapshot or release/);
});

test('rejects corrupt CSS, corrupt fonts and missing assets before producing output', async (t) => {
  for (const kind of ['css', 'font', 'missing']) await t.test(kind, async (t) => {
    const f = await fixture(t);
    const file = path.join(f.packageDir, kind === 'css' ? 'dist/tokens.css' : 'fonts/first.woff2');
    if (kind === 'missing') await rm(file);
    else await writeFile(file, 'corrupt bytes');
    await assert.rejects(prepareBrand(f.packageDir, f.outputDir), /missing|hash|sha256/i);
    await assert.rejects(readFile(path.join(f.outputDir, 'static/_brand/dist/tokens.css')), { code: 'ENOENT' });
  });
});

test('rejects traversal in manifest paths', async (t) => {
  const f = await fixture(t);
  const source = JSON.parse(await readFile(path.join(f.packageDir, 'source.json')));
  source.files[0].path = '../outside.css';
  await writeFile(path.join(f.packageDir, 'source.json'), JSON.stringify(source));
  await assert.rejects(prepareBrand(f.packageDir, f.outputDir), /path/i);
});

test('rejects a dist manifest that differs from the root manifest', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.packageDir, 'dist/source.json'), '{"schemaVersion":2}');
  await assert.rejects(prepareBrand(f.packageDir, f.outputDir), /dist\/source\.json.*match/i);
  await assert.rejects(readFile(path.join(f.outputDir, 'static/_brand/dist/tokens.css')), { code: 'ENOENT' });
});

test('rejects package symlinks, hardlinks and unpinned publishable files', async (t) => {
  for (const kind of ['symlink', 'hardlink', 'unpinned']) await t.test(kind, async (t) => {
    const f = await fixture(t);
    const extra = path.join(f.packageDir, 'fonts/extra.woff2');
    if (kind === 'symlink') await symlink('first.woff2', extra);
    else if (kind === 'hardlink') await link(path.join(f.packageDir, 'fonts/first.woff2'), extra);
    else await writeFile(path.join(f.packageDir, 'dist/unpinned.css'), 'untracked bytes');
    const expected = kind === 'unpinned' ? /asset missing from source manifest/i : new RegExp(kind, 'i');
    await assert.rejects(prepareBrand(f.packageDir, f.outputDir), expected);
  });
});


test('published provenance identifies the installed immutable archive and rejects mismatches', async (t) => {
  const f = await fixture(t);
  await prepareBrand(f.packageDir, f.outputDir);
  const lockPath = path.join(f.outputDir, 'package-lock.json');
  const installed = { version: '0.1.0', resolved: `https://github.com/unset-sh/brand/archive/${'a'.repeat(40)}.tar.gz`, integrity: `sha512-${Buffer.alloc(64).toString('base64')}` };
  const lock = { packages: { 'node_modules/@unset-sh/brand': installed } };
  await writeFile(lockPath, JSON.stringify(lock));
  await writeInstallationProvenance(lockPath, f.outputDir);
  const result = JSON.parse(await readFile(path.join(f.outputDir, 'static/_brand/provenance.json')));
  assert.deepEqual(result.installation, installed);
  installed.version = '0.1.1';
  await writeFile(lockPath, JSON.stringify(lock));
  await assert.rejects(writeInstallationProvenance(lockPath, f.outputDir), /version/i);
  installed.version = '0.1.0';
  installed.resolved = 'https://example.com/unverified.tar.gz';
  await writeFile(lockPath, JSON.stringify(lock));
  await assert.rejects(writeInstallationProvenance(lockPath, f.outputDir), /archive/i);
});


test('refuses a changed contract schema even when the manifest hashes match', async (t) => {
  const f = await fixture(t);
  f.files['dist/contract.json'] = JSON.stringify({ schemaVersion: 2, id: 'unset.brand' });
  await f.save();
  await assert.rejects(prepareBrand(f.packageDir, f.outputDir), /contract.*schema/i);
});

test('brand compatibility requires every consumed token while allowing site-owned variables', () => {
  const consumer = ':root {--local: 2rem} body {font-family:var(--font-sans);gap:var(--local);color:var(--ink)}';
  assert.doesNotThrow(() => verifyTokenUsage(firstCss, consumer));
  assert.throws(() => verifyTokenUsage(':root {--ink:black}', consumer), /font-sans/);
  assert.throws(() => verifyTokenUsage('/* --font-sans:ignored; */ :root {--ink:black}', consumer), /font-sans/);
});
