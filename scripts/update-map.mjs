import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchGitHubResponse } from './github-api.mjs';

// Public reads only. Resolve main once, then read content at that immutable SHA.
// https://docs.github.com/en/rest/commits/commits#get-a-commit
const repository = 'unset-sh/.github';
const commitEndpoint = `https://api.github.com/repos/${repository}/commits/main`;
const rawEndpoint = commit => `https://raw.githubusercontent.com/${repository}/${commit}/repos.json`;
const defaultDirectory = 'data/org-map';
const statuses = new Set(['active', 'pending', 'planned', 'proposed', 'archived']);
const isCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}
function text(value, label, empty = false) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > 8192 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) {
    throw new Error(`${label} must be readable text`);
  }
}
function array(value, label) {
  if (!Array.isArray(value) || value.length > 200) throw new Error(`${label} must be an array of at most 200 entries`);
}
function name(value, label) {
  if (typeof value !== 'string' || !/^(?:\.github|[A-Za-z0-9][A-Za-z0-9._-]{0,99})$/.test(value)) {
    throw new Error(`Invalid ${label} name`);
  }
}

// How the map refers to a repository: its bare name inside the organisation, owner/name outside it, so an outside
// repository can share a name with an organisation one (unset-sh/.github scripts/map.mjs repoKey). uses[].repo
// and a notHere "where" name repositories by this key.
export function repoKey(repo) {
  return repo.owner === undefined || repo.owner === 'unset-sh' ? repo.name : `${repo.owner}/${repo.name}`;
}

// The repository a uses[].repo names, or undefined. A bare name means an organisation repository. Until the
// snapshot from unset-sh/.github#27 is imported, the map still names the outside app by its bare name; that is
// read as the outside app only while no organisation repository has the name, so it can never take the place of one.
export function resolveDependency(repos, reference) {
  const exact = repos.find(repo => repoKey(repo) === reference);
  if (exact) return exact;
  return repos.find(repo => repo.owner !== undefined && repo.owner !== 'unset-sh' && repo.name === reference);
}

export function validateMap(data) {
  object(data, 'Map');
  if (data.org !== 'unset-sh') throw new Error('Map organisation must be unset-sh');
  text(data.licenceRule, 'licenceRule');
  array(data.groups, 'groups');
  if (!data.groups.length) throw new Error('Map requires at least one ownership group');
  const groups = new Set();
  for (const group of data.groups) {
    object(group, 'group'); name(group.id, 'group');
    if (groups.has(group.id.toLowerCase())) throw new Error(`Duplicate group: ${group.id}`);
    groups.add(group.id.toLowerCase());
    text(group.title, 'group title'); text(group.blurb, 'group blurb');
  }
  array(data.repos, 'repos');
  if (!data.repos.length) throw new Error('Map must contain repositories');
  const repos = new Map();
  for (const repo of data.repos) {
    object(repo, 'repository'); name(repo.name, 'repository');
    if (repo.owner !== undefined && repo.owner !== 'unset-sh' && !(repo.owner === 'Undefined6799' && repo.name === 'unset')) {
      throw new Error(`Unexpected external repository: ${repo.name}`);
    }
    const key = repoKey(repo);
    if (repos.has(key.toLowerCase())) throw new Error(`Duplicate repository: ${key}`);
    repos.set(key.toLowerCase(), repo);
    if (!statuses.has(repo.status)) throw new Error(`Unknown status: ${repo.status}`);
    if (!groups.has(repo.group)) throw new Error(`Unknown group: ${repo.group}`);
    for (const field of ['tagline', 'summary']) text(repo[field], `${repo.name}.${field}`);
    if (repo.description !== undefined) text(repo.description, 'description', true);
    if (repo.visibility !== undefined && !['public', 'private', 'internal'].includes(repo.visibility)) throw new Error('Invalid visibility');
    if (repo.hideFromProfile !== undefined && typeof repo.hideFromProfile !== 'boolean') throw new Error('Invalid hideFromProfile');
    array(repo.owns, `${repo.name}.owns`);
    repo.owns.forEach(value => text(value, 'owns'));
    array(repo.notHere, `${repo.name}.notHere`);
    for (const boundary of repo.notHere) {
      object(boundary, 'notHere'); text(boundary.what, 'notHere.what'); text(boundary.where, 'notHere.where');
    }
    array(repo.uses, `${repo.name}.uses`);
    const dependencies = new Set();
    for (const edge of repo.uses) {
      object(edge, 'dependency'); text(edge.how, 'dependency.how');
      if (edge.repo !== 'Undefined6799/unset') name(edge.repo, 'dependency');
      if (dependencies.has(edge.repo.toLowerCase())) throw new Error(`Duplicate dependency: ${repo.name} uses ${edge.repo}`);
      dependencies.add(edge.repo.toLowerCase());
    }
    object(repo.licence, 'licence');
    if (repo.licence.spdx !== null) text(repo.licence.spdx, 'licence.spdx');
    text(repo.licence.current, 'licence.current');
    if (typeof repo.licence.followsRule !== 'boolean') throw new Error('Invalid licence.followsRule');
    if (repo.links !== undefined) {
      object(repo.links, 'links');
      for (const [kind, value] of Object.entries(repo.links)) {
        text(value, 'link');
        if (kind === 'package' && /^@[a-z0-9-]+\/[a-z0-9._-]+$/.test(value)) continue;
        let url;
        try { url = new URL(value); } catch { throw new Error('Invalid map link'); }
        if (url.protocol !== 'https:' || url.username || url.password || /[\s\\]/.test(value)) throw new Error('Unsafe map link');
      }
    }
  }
  const complete = new Set();
  const visiting = new Set();
  function visit(repo) {
    const key = repoKey(repo);
    if (visiting.has(key)) throw new Error(`Dependency cycle at ${key}`);
    if (complete.has(key)) return;
    visiting.add(key);
    for (const edge of repo.uses) {
      const dependency = resolveDependency(data.repos, edge.repo);
      if (!dependency) throw new Error(`Unknown dependency: ${edge.repo}`);
      visit(dependency);
    }
    visiting.delete(key); complete.add(key);
  }
  data.repos.forEach(visit);
  return data;
}

function validateSource(source) {
  object(source, 'provenance');
  if (source.collectedAt !== undefined && (typeof source.collectedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source.collectedAt)
    || !Number.isFinite(Date.parse(source.collectedAt))
    || new Date(source.collectedAt).toISOString() !== source.collectedAt)) {
    throw new Error('Invalid organisation map collection time');
  }
  if (source.schemaVersion !== 1 || source.repository !== repository || source.path !== 'repos.json'
    || !isCommit(source.commit) || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)
    || typeof source.ref !== 'string'
    || !(source.ref === 'main' || /^pull\/[1-9][0-9]*\/head$/.test(source.ref))) {
    throw new Error('Invalid organisation map provenance');
  }
}
async function safeDirectory(directory) {
  const absolute = path.resolve(directory);
  let current = path.parse(absolute).root;
  for (const segment of absolute.slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Map directory must be regular, without symlinks: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await mkdir(current);
    }
  }
  return absolute;
}
async function regularFile(filename, optional = false) {
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error(`Map output must be a regular file: ${filename}`);
  } catch (error) {
    if (!optional || error.code !== 'ENOENT') throw error;
  }
}
export async function checkMap(directory = defaultDirectory) {
  for (const file of ['repos.json', 'source.json']) await regularFile(path.join(directory, file));
  const bytes = await readFile(path.join(directory, 'repos.json'));
  const source = JSON.parse(await readFile(path.join(directory, 'source.json'), 'utf8'));
  validateSource(source);
  if (digest(bytes) !== source.sha256) throw new Error('Organisation map digest does not match its provenance');
  return validateMap(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}
async function fetchBytes(url, fetchImpl, githubToken) {
  let response;
  if (url === commitEndpoint) response = await fetchGitHubResponse(url, { fetchImpl, githubToken });
  else {
    try {
      response = await fetchImpl(url, {
        redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/json' },
      });
    } catch { throw new Error('Map source request failed before a response was available'); }
  }
  if (response.status !== 200 || !response.body) throw new Error(`Map source request failed: HTTP ${response.status}`);
  const parts = []; let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 1_048_576) throw new Error('Map source exceeds 1 MiB');
      parts.push(Buffer.from(chunk));
    }
  } catch {
    throw new Error(size > 1_048_576 ? 'Map source exceeds 1 MiB' : 'Map source response body could not be read');
  }
  return Buffer.concat(parts);
}
export async function updateMap({ directory = defaultDirectory, fetchImpl = fetch, githubToken, now = () => new Date() } = {}) {
  const commitBytes = await fetchBytes(commitEndpoint, fetchImpl, githubToken);
  let commit;
  try { commit = JSON.parse(commitBytes).sha; } catch { throw new Error('Malformed GitHub JSON for map commit'); }
  if (!isCommit(commit)) throw new Error('Map source did not resolve main to an immutable commit');
  const bytes = await fetchBytes(rawEndpoint(commit), fetchImpl);
  validateMap(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const source = { schemaVersion: 1, repository, path: 'repos.json', ref: 'main', commit, sha256: digest(bytes), collectedAt: now().toISOString() };
  validateSource(source);
  directory = await safeDirectory(directory);
  for (const file of ['repos.json', 'source.json']) await regularFile(path.join(directory, file), true);
  const id = randomUUID();
  const temporary = ['repos.json', 'source.json'].map(file => path.join(directory, `.${file}.${id}`));
  try {
    await writeFile(temporary[0], bytes, { flag: 'wx' });
    await writeFile(temporary[1], `${JSON.stringify(source, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary[0], path.join(directory, 'repos.json'));
    await rename(temporary[1], path.join(directory, 'source.json'));
  } finally {
    await Promise.all(temporary.map(file => rm(file, { force: true })));
  }
  return source;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const githubToken = process.env.DOCS_GITHUB_TOKEN;
  delete process.env.DOCS_GITHUB_TOKEN;
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      const source = await updateMap({ githubToken });
      console.log(`Organisation map: ${source.repository}@${source.commit}`);
    } else if (args.length === 1 && args[0] === '--check') {
      const map = await checkMap();
      console.log(`Verified organisation map: ${map.repos.length} repositories`);
    } else throw new Error('Usage: node scripts/update-map.mjs [--check]');
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}
