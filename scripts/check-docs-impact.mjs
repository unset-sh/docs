import { execFile } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
const shaPattern = /^[a-fA-F0-9]{40}$/;
const matches = (file, matcher) => matcher.exact !== undefined ? file === matcher.exact : file.startsWith(matcher.prefix);
const matchesAny = (file, matchers) => matchers.some(matcher => matches(file, matcher));

function validateMatchers(matchers, allowEmpty = false) {
  if (!Array.isArray(matchers) || (!allowEmpty && !matchers.length)) throw new Error('Policy needs nonempty path matchers');
  for (const matcher of matchers) {
    const keys = matcher && Object.keys(matcher);
    const key = keys?.[0];
    const value = matcher?.[key];
    if (keys?.length !== 1 || !['exact', 'prefix'].includes(key) || typeof value !== 'string'
      || !value || value.startsWith('/') || /[\\\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid policy path matcher');
    const parts = (key === 'prefix' ? value.slice(0, -1) : value).split('/');
    if ((key === 'prefix' && !value.endsWith('/')) || parts.some(part => !part || part === '.' || part === '..')) {
      throw new Error('Policy prefix must end in / and paths must be repository-relative');
    }
  }
}

function validatePolicy(policy) {
  if (policy?.schemaVersion !== 1 || !Array.isArray(policy.rules) || !policy.fallback) throw new Error('Invalid docs impact policy');
  validateMatchers(policy.exclude, true);
  validateMatchers(policy.documentation);
  const ids = new Set();
  for (const rule of [...policy.rules, policy.fallback]) {
    if (!rule || !/^[a-z0-9][a-z0-9-]*$/.test(rule.id) || ids.has(rule.id)) throw new Error('Policy rule IDs must be unique');
    ids.add(rule.id);
    validateMatchers(rule.docs);
    if (rule !== policy.fallback) validateMatchers(rule.source);
  }
}

function explicitReason(body) {
  if (body === null) return null;
  if (typeof body !== 'string') throw new Error('PR body must be text or null');
  const reasons = [];
  let fence = null;
  let comment = false;
  for (const line of body.split(/\r?\n/)) {
    if (comment || line.includes('<!--')) {
      comment = !line.includes('-->');
      continue;
    }
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (delimiter) {
      if (!fence) fence = delimiter;
      else if (delimiter[0] === fence[0] && delimiter.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const match = /^Docs impact: no update needed — (.*)$/.exec(line);
    if (match) reasons.push(match[1].trim());
  }
  if (!reasons.length) return null;
  if (reasons.length !== 1 || reasons[0].length < 20 || reasons[0].split(/\s+/).length < 4
    || /^<.*>$/.test(reasons[0])) throw new Error('Use one single Docs impact reason line with at least 20 characters and four words');
  return reasons[0];
}

export function evaluateImpact(paths, policy, body = null) {
  validatePolicy(policy);
  if (!Array.isArray(paths) || paths.some(file => typeof file !== 'string' || !file || file.includes('\0'))) {
    throw new Error('Changed paths must be nonempty file names');
  }
  const files = [...new Set(paths)].filter(file => !matchesAny(file, policy.exclude));
  const affected = new Map();
  for (const file of files) {
    if (matchesAny(file, policy.documentation)) continue;
    // Specific rules go first; the fallback accounts for newly introduced areas.
    const rule = policy.rules.find(candidate => matchesAny(file, candidate.source)) || policy.fallback;
    if (!affected.has(rule.id)) affected.set(rule.id, { id: rule.id, sources: [], documentation: rule.docs });
    affected.get(rule.id).sources.push(file);
  }
  const missing = [...affected.values()].filter(rule => !files.some(file => matchesAny(file, rule.documentation)));
  const reason = missing.length ? explicitReason(body) : null;
  return { ok: missing.length === 0 || reason !== null, missing, reason };
}

function commitSha(value) {
  if (typeof value !== 'string' || !shaPattern.test(value)) throw new Error('Base and head must be complete 40-character hexadecimal commit SHAs');
  return value.toLowerCase();
}

export function parseInput(args, env = {}) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--base', '--head', '--config'].includes(flag) || options[flag] !== undefined
      || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Invalid or duplicate docs impact argument');
    options[flag] = args[index + 1];
  }
  if (Boolean(options['--base']) !== Boolean(options['--head'])) throw new Error('Both --base and --head are required');
  const base = options['--base'] && commitSha(options['--base']);
  const head = options['--head'] && commitSha(options['--head']);
  if (!base && !env.GITHUB_EVENT_PATH) throw new Error('Provide --base SHA and --head SHA or a current GITHUB_EVENT_PATH');
  return { base, head, config: options['--config'] || '.github/docs-impact.json', eventPath: env.GITHUB_EVENT_PATH || null };
}

export async function changedPaths({ cwd = process.cwd(), base, head }) {
  base = commitSha(base);
  head = commitSha(head);
  const { stdout } = await exec('git', ['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', '--no-textconv', `${base}...${head}`, '--'], {
    cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, shell: false,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', GIT_OPTIONAL_LOCKS: '0' },
  });
  return stdout.split('\0').filter(Boolean);
}

async function readJson(filename) {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Expected regular JSON file: ${filename}`);
  try {
    return JSON.parse(await readFile(filename, 'utf8'));
  } catch {
    throw new Error(`Invalid JSON file: ${filename}`);
  }
}

export async function checkDocsImpact({ cwd = process.cwd(), args = process.argv.slice(2), env = process.env, report = console.log } = {}) {
  const input = parseInput(args, env);
  let { base, head } = input;
  let body = null;
  if (input.eventPath) {
    if (env.GITHUB_EVENT_NAME && env.GITHUB_EVENT_NAME !== 'pull_request') throw new Error('Docs impact requires a current pull_request event');
    const event = await readJson(path.resolve(cwd, input.eventPath));
    const pr = event?.pull_request;
    const eventBase = commitSha(pr?.base?.sha);
    const eventHead = commitSha(pr?.head?.sha);
    if (base && (base !== eventBase || head !== eventHead)) throw new Error('Explicit revisions do not match the current PR event');
    if (pr.body !== null && typeof pr.body !== 'string') throw new Error('Current PR event body must be text or null');
    base = eventBase;
    head = eventHead;
    body = pr.body;
  }
  const policy = await readJson(path.resolve(cwd, input.config));
  const result = evaluateImpact(await changedPaths({ cwd, base, head }), policy, body);
  if (!result.ok) {
    const details = result.missing.map(rule => `${rule.id}: ${rule.sources.map(file => JSON.stringify(file)).join(', ')} → ${rule.documentation.map(matcher => matcher.exact || matcher.prefix).join(', ')}`).join('\n');
    throw new Error(`Documentation impact is unaccounted for:\n${details}\nUpdate the related documentation or explain why no update is needed in the current PR body.`);
  }
  report(result.reason ? `Docs impact reason for human review: ${result.reason}` : 'Docs impact: relevant documentation changes are present, or no covered source changed.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await checkDocsImpact();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
