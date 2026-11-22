import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Schema 2 is the package's exported CSS contract. Preserve its bytes and layout;
// resolving tokens or rewriting font URLs belongs to @unset-sh/brand itself.
const assetPath = /^(dist|fonts|logo|icons)\//;
const dataFiles = {
  contract: 'dist/contract.json',
  resolved: 'dist/resolved.json',
  meta: 'dist/meta.json',
  icons: 'icons/tabler/icons.json',
  iconMap: 'icons/tabler/icon-map.json',
};
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function relativePath(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid brand path: ${value}`);
  }
  return value;
}

async function regularFiles(directory, prefix = '') {
  const info = await lstat(directory);
  if (info.isSymbolicLink()) throw new Error(`Brand symlink refused: ${directory}`);
  if (!info.isDirectory()) throw new Error(`Brand directory required: ${directory}`);
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    const filename = path.join(directory, entry.name);
    const stat = await lstat(filename);
    if (stat.isSymbolicLink()) throw new Error(`Brand symlink refused: ${name}`);
    if (stat.isDirectory()) files.push(...await regularFiles(filename, `${name}/`));
    else if (stat.isFile()) {
      if (stat.nlink !== 1) throw new Error(`Brand hardlink refused: ${name}`);
      files.push(name);
    } else throw new Error(`Brand file is not regular: ${name}`);
  }
  return files;
}

async function verifiedPackage(packageDir) {
  const files = new Set(await regularFiles(packageDir));
  const sourceBytes = await readFile(path.join(packageDir, 'source.json'));
  const source = JSON.parse(sourceBytes);
  if (source.schemaVersion !== 2) {
    throw new Error('Brand source schemaVersion 2 is required; the old published package is unsupported. Supply the new brand snapshot or release.');
  }
  if (!Array.isArray(source.files)) throw new Error('Brand source manifest needs files');
  const verified = new Map();
  for (const entry of source.files) {
    const name = relativePath(entry.path);
    if (verified.has(name)) throw new Error(`Duplicate brand manifest path: ${name}`);
    if (!files.has(name)) throw new Error(`Brand manifest file missing: ${name}`);
    const data = await readFile(path.join(packageDir, name));
    if (!/^[a-f0-9]{64}$/.test(entry.sha256) || sha256(data) !== entry.sha256) {
      throw new Error(`Brand sha256 hash mismatch: ${name}`);
    }
    verified.set(name, data);
  }
  if (files.has('dist/source.json')) {
    // The generated manifest copy cannot contain its own hash.
    const copy = await readFile(path.join(packageDir, 'dist/source.json'));
    if (!copy.equals(sourceBytes)) throw new Error('Brand dist/source.json must match the root source manifest');
    verified.set('dist/source.json', copy);
  }
  for (const name of files) {
    if (assetPath.test(name) && !verified.has(name)) throw new Error(`Brand asset missing from source manifest: ${name}`);
  }
  for (const name of ['dist/tokens.css', ...Object.values(dataFiles)]) {
    if (!verified.has(name)) throw new Error(`Brand export missing from source manifest: ${name}`);
    if (name.endsWith('.json')) JSON.parse(verified.get(name));
  }
  const contract = JSON.parse(verified.get('dist/contract.json'));
  if (contract.id !== 'unset.brand' || contract.schemaVersion !== 1) {
    throw new Error('Unsupported brand contract identity or schema version');
  }
  const assets = new Map([...verified].filter(([name]) => assetPath.test(name)));
  for (const name of ['LICENSE', 'LICENSE-ASSETS.md']) {
    if (!files.has(name)) throw new Error(`Brand licence missing: ${name}`);
  }
  for (const name of files) {
    if (/^(LICENSE(?:[.-].*)?|THIRD-PARTY-NOTICES\.md)$/.test(name)) {
      // Root licences are package files, not generated contract pins.
      assets.set(name, await readFile(path.join(packageDir, name)));
    }
  }
  const packageBytes = await readFile(path.join(packageDir, 'package.json'));
  const metadata = JSON.parse(packageBytes);
  if (metadata.name !== '@unset-sh/brand' || typeof metadata.version !== 'string' || metadata.version !== source.version) {
    throw new Error('Brand package name or version does not match its source manifest');
  }
  const provenance = {
    name: metadata.name,
    version: metadata.version,
    sourceSha256: sha256(sourceBytes),
    packageJsonSha256: sha256(packageBytes),
    contractSha256: source.contractSha256,
    verifiedFileCount: verified.size,
    files: [...assets].map(([name, data]) => ({ path: name, sha256: sha256(data) })),
  };
  return { assets, sourceBytes, provenance };
}

async function writeOutput(directory, name, data) {
  const destination = path.join(directory, name);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
}

export async function prepareBrand(packageDir = 'node_modules/@unset-sh/brand', outputDir = '.build/brand') {
  packageDir = path.resolve(packageDir);
  outputDir = path.resolve(outputDir);
  if (outputDir === packageDir || outputDir.startsWith(`${packageDir}${path.sep}`)
    || packageDir.startsWith(`${outputDir}${path.sep}`)) {
    throw new Error('Brand output path must not overlap the package');
  }
  const { assets, sourceBytes, provenance } = await verifiedPackage(packageDir);
  try {
    await regularFiles(outputDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const staticDir = path.join(outputDir, 'static/_brand');
  const dataDir = path.join(outputDir, 'data/brand');
  await rm(path.join(outputDir, 'static'), { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
  await rm(path.join(outputDir, 'assets/css/brand.css'), { force: true });
  for (const [name, data] of assets) await writeOutput(staticDir, name, data);
  for (const [name, source] of Object.entries(dataFiles)) {
    await writeOutput(dataDir, `${name}.json`, assets.get(source));
  }
  await writeOutput(outputDir, 'source.json', sourceBytes);
  await writeOutput(outputDir, 'provenance.json', `${JSON.stringify(provenance, null, 2)}\n`);
}

export function verifyTokenUsage(brandCss, consumerCss) {
  const clean = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const definitions = (css) => [...clean(css).matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]);
  const available = new Set([...definitions(brandCss), ...definitions(consumerCss)]);
  for (const [, name] of clean(consumerCss).matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!available.has(name)) throw new Error(`Brand release is missing consumed token ${name}`);
  }
}

export async function writeInstallationProvenance(lockPath = 'package-lock.json', outputDir = '.build/brand') {
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  const installed = lock.packages?.['node_modules/@unset-sh/brand'];
  const provenance = JSON.parse(await readFile(path.join(outputDir, 'provenance.json'), 'utf8'));
  if (installed?.version !== provenance.version) throw new Error('Installed brand version does not match verified assets');
  if (!/^https:\/\/github\.com\/unset-sh\/brand\/archive\/[a-f0-9]{40}\.tar\.gz$/.test(installed.resolved)) {
    throw new Error('Brand provenance requires an immutable organisation archive');
  }
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(installed.integrity)) throw new Error('Brand archive integrity is missing');
  provenance.installation = { version: installed.version, resolved: installed.resolved, integrity: installed.integrity };
  if (/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '')) provenance.frameworkCommit = process.env.GITHUB_SHA;
  await writeOutput(outputDir, 'static/_brand/provenance.json', `${JSON.stringify(provenance, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length > 4) throw new Error('Usage: node scripts/brand.mjs [packageDir] [outputDir]');
  await prepareBrand(process.argv[2], process.argv[3]);
  if (!process.argv[2]) {
    const cssFiles = (await readdir('assets/css')).filter((name) => name.endsWith('.css'));
    const consumerCss = (await Promise.all(cssFiles.map((name) => readFile(path.join('assets/css', name), 'utf8')))).join('\n');
    verifyTokenUsage(await readFile('.build/brand/static/_brand/dist/tokens.css', 'utf8'), consumerCss);
    await writeInstallationProvenance();
  }
}
