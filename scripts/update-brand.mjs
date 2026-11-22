import { spawn } from 'node:child_process';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { fetchGitHubResponse } from './github-api.mjs';

const name = '@unset-sh/brand';
const packageKey = `node_modules/${name}`;
const apiRoot = 'https://api.github.com/repos/unset-sh/brand/';
const archive = (commit) => `https://github.com/unset-sh/brand/archive/${commit}.tar.gz`;
const shaPattern = /^[a-f0-9]{40}$/;
const archivePattern = /^https:\/\/github\.com\/unset-sh\/brand\/archive\/([a-f0-9]{40})\.tar\.gz$/;
const isIntegrity = (value) => typeof value === 'string' && /^sha512-[A-Za-z0-9+/]{86}==$/.test(value)
  && Buffer.from(value.slice(7), 'base64').toString('base64') === value.slice(7);

function patchVersion(version) {
  const match = typeof version === 'string' && /^0\.1\.(0|[1-9]\d*)$/.exec(version);
  return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
}

export function selectRelease(releases, currentVersion = '0.1.1') {
  const current = patchVersion(currentVersion);
  if (current === null || current < 1) throw new Error('Brand version must meet the 0.1.1 baseline within 0.1.x');
  if (!Array.isArray(releases)) throw new Error('Malformed GitHub releases response');
  let selected = null;
  for (const release of releases) {
    if (!release || typeof release.tag_name !== 'string' || typeof release.draft !== 'boolean'
      || typeof release.prerelease !== 'boolean' || (release.published_at !== null
        && (typeof release.published_at !== 'string' || !Number.isFinite(Date.parse(release.published_at))))) {
      throw new Error('Malformed GitHub release metadata');
    }
    const patch = release.tag_name.startsWith('v') ? patchVersion(release.tag_name.slice(1)) : null;
    if (patch === null || patch < current || release.draft || release.prerelease || !release.published_at) continue;
    if (!selected || patch > patchVersion(selected.tag_name.slice(1))) selected = release;
  }
  return selected;
}

async function fetchJson(fetchImpl, route, githubToken) {
  const response = await fetchGitHubResponse(`${apiRoot}${route}`, { fetchImpl, githubToken });
  try {
    return { data: await response.json(), nextPage: /rel="next"/.test(response.headers.get('link') || '') };
  } catch {
    throw new Error(`Malformed GitHub JSON: ${route}`);
  }
}

export async function resolveRelease({ fetchImpl = fetch, currentVersion = '0.1.1', githubToken } = {}) {
  const releases = [];
  for (let page = 1; ; page += 1) {
    if (page > 100) throw new Error('GitHub release pagination exceeded its limit');
    const { data, nextPage } = await fetchJson(fetchImpl, `releases?per_page=100&page=${page}`, githubToken);
    if (!Array.isArray(data) || data.length > 100) throw new Error('Malformed GitHub releases page');
    releases.push(...data);
    if (!nextPage && data.length < 100) break;
  }
  const release = selectRelease(releases, currentVersion);
  if (!release) return null;
  const tag = release.tag_name;
  const { data: ref } = await fetchJson(fetchImpl, `git/ref/tags/${tag}`, githubToken);
  if (ref?.ref !== `refs/tags/${tag}`) throw new Error('GitHub tag reference does not match the release');
  let object = ref.object;
  const seen = new Set();
  for (let depth = 0; depth < 10; depth += 1) {
    if (!object || !shaPattern.test(object.sha) || !['tag', 'commit'].includes(object.type)) {
      throw new Error('Malformed GitHub tag object type or commit SHA');
    }
    if (object.type === 'commit') return { version: tag.slice(1), tag, commit: object.sha, url: archive(object.sha) };
    if (seen.has(object.sha)) throw new Error('GitHub annotated tag cycle');
    seen.add(object.sha);
    const { data } = await fetchJson(fetchImpl, `git/tags/${object.sha}`, githubToken);
    if (data?.sha !== object.sha || (depth === 0 && data.tag !== tag)) {
      throw new Error('GitHub annotated tag name or SHA does not match the release');
    }
    object = data.object;
  }
  throw new Error('GitHub annotated tag nesting exceeded its limit');
}

async function readRegular(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Brand update requires a regular, unlinked file: ${file}`);
  const bytes = await readFile(file);
  return { bytes, data: JSON.parse(bytes) };
}

function verifyLock(lock, version, url) {
  const brand = lock.packages?.[packageKey];
  if (patchVersion(version) === null || patchVersion(version) < 1 || lock.lockfileVersion !== 3 || brand?.version !== version
    || (brand.name !== undefined && brand.name !== name)) throw new Error('Brand lock package name or version mismatch');
  if (brand.resolved !== url || lock.packages['']?.devDependencies?.[name] !== url) throw new Error('Brand lock archive URL mismatch');
  if (!isIntegrity(brand.integrity)) {
    throw new Error('Brand lock needs SHA512 archive integrity');
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (Object.keys(brand[field] || {}).length) throw new Error('Brand release must remain a data-only dependency');
  }
}

async function deployedBrand(fetchImpl) {
  try {
    const response = await fetchImpl('https://docs.unset.sh/_brand/provenance.json', {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      redirect: 'error', signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) return null;
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    const provenance = await response.json();
    const installation = provenance?.installation;
    const version = patchVersion(provenance?.version);
    const commit = typeof installation?.resolved === 'string' && archivePattern.exec(installation.resolved)?.[1];
    if (version === null || version < 1 || installation?.version !== provenance.version
      || !commit || !isIntegrity(installation.integrity)) throw new Error('Invalid version, archive or integrity metadata');
    return { version: provenance.version, commit, integrity: installation.integrity };
  } catch {
    throw new Error('Cannot verify deployed brand provenance');
  }
}

function verifyDeployed(release, integrity, deployed) {
  if (deployed && release.version === deployed.version) {
    if (release.commit !== deployed.commit) throw new Error('Brand deployed release tag moved to a different commit');
    if (integrity !== deployed.integrity) throw new Error('Brand archive integrity differs from the deployed release');
  }
}

function npm(args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', args, { cwd, env, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`npm failed (${signal || code})`)));
  });
}

export async function updateBrand({ directory = process.cwd(), fetchImpl = fetch, runNpm = npm, report = console.log, githubToken } = {}) {
  const packageFile = path.join(directory, 'package.json');
  const lockFile = path.join(directory, 'package-lock.json');
  const beforePackage = await readRegular(packageFile);
  const beforeLock = await readRegular(lockFile);
  const currentUrl = beforePackage.data.devDependencies?.[name];
  const currentCommit = typeof currentUrl === 'string' && archivePattern.exec(currentUrl)?.[1];
  const currentVersion = beforeLock.data.packages?.[packageKey]?.version;
  if (!currentCommit) throw new Error('Brand dependency must pin the fixed repository commit archive URL');
  verifyLock(beforeLock.data, currentVersion, currentUrl);
  const deployed = await deployedBrand(fetchImpl);
  if (!deployed) report(`No deployed brand provenance (HTTP 404); using checked-in baseline ${currentVersion}.`);
  const minimumVersion = deployed && patchVersion(deployed.version) > patchVersion(currentVersion) ? deployed.version : currentVersion;
  const release = await resolveRelease({ fetchImpl, currentVersion: minimumVersion, githubToken });
  if (!release) {
    if (deployed) throw new Error(`No published compatible release meets the deployed brand ${deployed.version} and checkout baseline`);
    report(`No published compatible release; retaining brand ${currentVersion} at ${currentCommit}.`);
    return { status: 'fallback', version: currentVersion, commit: currentCommit };
  }
  if (release.version === deployed?.version && release.commit !== deployed.commit) {
    throw new Error('Brand deployed release tag moved to a different commit');
  }
  if (release.version === currentVersion) {
    if (release.commit !== currentCommit) throw new Error('Brand same-version release tag moved from its pinned commit');
    verifyDeployed(release, beforeLock.data.packages[packageKey].integrity, deployed);
    report(`Brand ${release.version} already pinned at ${release.commit}.`);
    return { status: 'unchanged', ...release };
  }
  const nextPackage = structuredClone(beforePackage.data);
  nextPackage.devDependencies[name] = release.url;
  try {
    await writeFile(packageFile, `${JSON.stringify(nextPackage, null, 2)}\n`);
    const env = { ...process.env };
    delete env.DOCS_GITHUB_TOKEN;
    await runNpm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: directory, env });
    const afterPackage = await readRegular(packageFile);
    const afterLock = await readRegular(lockFile);
    if (!isDeepStrictEqual(afterPackage.data, nextPackage)) throw new Error('npm changed unrelated package metadata');
    verifyLock(afterLock.data, release.version, release.url);
    verifyDeployed(release, afterLock.data.packages[packageKey].integrity, deployed);
    const expected = structuredClone(beforeLock.data);
    expected.packages[''].devDependencies[name] = release.url;
    expected.packages[packageKey] = afterLock.data.packages[packageKey];
    if (!isDeepStrictEqual(afterLock.data, expected)) throw new Error('npm changed an unrelated dependency or lock metadata');
  } catch (error) {
    await writeFile(packageFile, beforePackage.bytes);
    await writeFile(lockFile, beforeLock.bytes);
    throw error;
  }
  report(`Brand ${release.version} resolved to ${release.commit}; package archive and lock integrity updated.`);
  return { status: 'updated', ...release };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const githubToken = process.env.DOCS_GITHUB_TOKEN;
  delete process.env.DOCS_GITHUB_TOKEN;
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/update-brand.mjs');
  await updateBrand({ githubToken });
}
