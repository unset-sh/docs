import { cp, lstat, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';

const generated = new Set(['node_modules', '.build', 'public', 'resources']);
const framework = new Set([
  'assets', 'static', 'layouts', 'content', 'data', 'i18n', 'archetypes', 'scripts', 'tests',
]);

async function checkSection(filename, name) {
  const text = await readFile(filename, 'utf8');
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const document = header && parseDocument(header[1]);
  const data = document?.errors.length === 0 ? document.toJS() : null;
  if (!data || typeof data.title !== 'string' || !data.title.trim()
    || data.type !== 'docs' || data.cascade?.type !== 'docs'
    || !Number.isInteger(data.menus?.main?.weight)) {
    throw new Error(`Invalid section front matter in ${name}/_index.md: require title, type: docs, cascade.type: docs, and integer menus.main.weight`);
  }
}

async function inspect(root) {
  const entries = new Map();
  async function visit(path, relative) {
    // lstat inspects a link itself, including a broken link, without following it.
    // Node 26.12.0: https://nodejs.org/download/release/v26.12.0/docs/api/fs.html#fspromiseslstatpath-options
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic link refused: ${relative || '.'}`);
    if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Special file refused: ${relative || '.'}`);
    if (stat.isFile() && stat.nlink > 1) throw new Error(`Hardlink refused: ${relative}`);
    entries.set(relative, stat);
    if (relative === '.git') return;
    if (generated.has(relative)) {
      if (!stat.isDirectory()) throw new Error(`Generated path must be a directory: ${relative}`);
      return;
    }
    if (stat.isDirectory()) {
      for (const name of (await readdir(path)).sort()) {
        await visit(join(path, name), relative ? `${relative}/${name}` : name);
      }
    }
  }
  await visit(root, '');
  if (!entries.get('').isDirectory()) throw new Error('The source root must be a directory');
  return entries;
}

export async function prepare(root = process.cwd(), { publish = false } = {}) {
  root = resolve(root);
  const entries = await inspect(root);
  const sections = [];
  for (const [name, stat] of entries) {
    if (!name || name.includes('/') || !stat.isDirectory()) continue;
    if (name.startsWith('.') || generated.has(name) || name === 'unset') continue;
    if (framework.has(name)) {
      if (name !== 'content' && entries.has(`${name}/_index.md`)) {
        throw new Error(`Section index in reserved framework folder: ${name}`);
      }
      continue;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`Unsafe repository section name: ${name}`);
    if (!entries.get(`${name}/_index.md`)?.isFile()) {
      throw new Error(`Section requires a regular _index.md: ${name}`);
    }
    if (entries.has(`content/${name}`)
      || ['md', 'markdown', 'mdown', 'html', 'htm'].some((extension) => entries.has(`content/${name}.${extension}`))) {
      throw new Error(`Section clashes with root content: ${name}`);
    }
    await checkSection(join(root, name, '_index.md'), name);
    sections.push(name);
  }
  if (entries.has('content') && !entries.get('content').isDirectory()) {
    throw new Error('Root content must be a directory');
  }
  if (publish && entries.has('unset')) throw new Error('Cannot publish while the legacy unset/ source remains');
  if (publish && sections.length === 0) throw new Error('Cannot publish without an organisation source section');

  // No generated output changes until every source and publishing guard passes.
  const staging = join(root, '.build', 'content');
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  if (entries.has('content')) await cp(join(root, 'content'), staging, { recursive: true });
  for (const name of sections) await cp(join(root, name), join(staging, name), { recursive: true });
  return sections.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (new Set(args).size !== args.length || args.some((argument) => !['--publish', '--json'].includes(argument))) {
      throw new Error('Usage: node scripts/prepare.mjs [--publish] [--json]');
    }
    const sections = await prepare(process.cwd(), { publish: args.includes('--publish') });
    console.log(args.includes('--json') ? JSON.stringify(sections) : `Prepared ${sections.length} organisation section(s)`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
