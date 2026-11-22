import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { parseDocument } from 'yaml';
import collector from '../data/workflow-map/collector.json' with { type: 'json' };
import { validateWorkflowView } from './workflow-view.mjs';

const run = promisify(execFile);
const defaultDirectory = 'data/workflow-map';
const maximumSnapshotBytes = 4_194_304;

export function parseWorkflowYaml(source) {
  // YAML 2.9.1: unlike privileged local workflow validation, read-only extraction
  // permits bounded aliases. Errors never include upstream YAML or parser causes.
  // https://eemeli.org/yaml/#parsing-documents
  try {
    if (typeof source !== 'string' || Buffer.byteLength(source) > 1_048_576) throw new Error();
    const document = parseDocument(source, { version: '1.2', strict: true, uniqueKeys: true });
    if (document.errors.length || document.warnings.length) throw new Error();
    const value = document.toJS({ maxAliasCount: 100 });
    if (Buffer.byteLength(JSON.stringify(value)) > maximumSnapshotBytes) throw new Error();
    return value;
  } catch { throw new Error('Invalid, ambiguous or oversized workflow YAML'); }
}

async function regularFile(filename, optional = false) {
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Workflow map requires a regular file');
    if (stat.size > maximumSnapshotBytes) throw new Error('Workflow map file is too large');
  } catch (error) {
    if (!optional || error.code !== 'ENOENT') throw error;
  }
}

async function safeDirectory(directory, create = false) {
  const absolute = path.resolve(directory);
  let current = path.parse(absolute).root;
  for (const segment of absolute.slice(current.length).split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Workflow map directory must be regular, without symlinks');
    } catch (error) {
      if (!create || error.code !== 'ENOENT') throw error;
      await mkdir(current);
    }
  }
  return absolute;
}

async function loadCollector() {
  // Only production refresh loads the separate, immutable checkout. Ordinary
  // checks/builds neither require this directory nor fetch an implementation.
  const directory = await safeDirectory('.build/tooling');
  if (collector.repository !== 'unset-sh/tooling' || !/^[a-f0-9]{40}$/.test(collector.commit)) {
    throw new Error('Invalid workflow collector pin');
  }
  try {
    const git = async args => (await run('git', ['-C', directory, ...args], { maxBuffer: 1_048_576 })).stdout.trim();
    if (await git(['rev-parse', '--show-toplevel']) !== directory
      || await git(['rev-parse', 'HEAD']) !== collector.commit
      || !/^https:\/\/github\.com\/unset-sh\/tooling(?:\.git)?$/.test(await git(['config', '--get', 'remote.origin.url']))
      || await git(['status', '--porcelain', '--untracked-files=all']) !== '') throw new Error();
    await regularFile(path.join(directory, 'scripts/workflow-catalogue.mjs'));
  } catch { throw new Error('Workflow collector must be a clean checkout of its reviewed repository and commit'); }
  return (await import(pathToFileURL(path.join(directory, 'scripts/workflow-catalogue.mjs')).href)).collectWorkflowCatalogue;
}

export async function checkWorkflowMap(directory = defaultDirectory) {
  await safeDirectory(directory);
  const filename = path.join(directory, 'catalogue.json');
  await regularFile(filename);
  let catalogue;
  try { catalogue = JSON.parse(await readFile(filename, 'utf8')); }
  catch { throw new Error('Workflow map snapshot must contain valid JSON'); }
  return validateWorkflowView(catalogue);
}

export async function refreshWorkflowMap({ directory = defaultDirectory, collect, githubToken,
  collectorCommit = collector.commit } = {}) {
  const collectorFunction = collect ?? await loadCollector();
  let catalogue;
  try { catalogue = await collectorFunction({ parseYaml: parseWorkflowYaml, githubToken, collectorCommit }); }
  catch { throw new Error('Workflow collection failed; the previous snapshot has been retained'); }
  validateWorkflowView(catalogue);
  if (catalogue.collector.repository !== 'unset-sh/tooling' || catalogue.collector.commit !== collectorCommit) {
    throw new Error('Workflow catalogue does not match the reviewed collector revision');
  }
  const bytes = `${JSON.stringify(catalogue, null, 2)}\n`;
  if (Buffer.byteLength(bytes) > maximumSnapshotBytes) throw new Error('Workflow map snapshot is too large');
  directory = await safeDirectory(directory, true);
  const destination = path.join(directory, 'catalogue.json');
  await regularFile(destination, true);
  const temporary = path.join(directory, `.catalogue.${randomUUID()}.json`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await rename(temporary, destination);
  } finally { await rm(temporary, { force: true }); }
  return catalogue;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const githubToken = process.env.DOCS_GITHUB_TOKEN;
  delete process.env.DOCS_GITHUB_TOKEN;
  try {
    const args = process.argv.slice(2);
    let catalogue;
    if (args.length === 0) catalogue = await refreshWorkflowMap({ githubToken });
    else if (args.length === 1 && args[0] === '--check') catalogue = await checkWorkflowMap();
    else throw new Error('Usage: node scripts/update-workflow-map.mjs [--check]');
    console.log(`Workflow map: ${catalogue.repositories.length} public repositories, ${catalogue.workflows.filter(item => item.current).length} current workflows`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
