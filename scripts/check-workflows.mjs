import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';

const actionPin = /^actions\/[a-z0-9-]+@[a-f0-9]{40}$/;
const isMap = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const equalMap = (value, expected) => isMap(value)
  && Object.keys(value).length === Object.keys(expected).length
  && Object.entries(expected).every(([key, item]) => value[key] === item);

export function validateWorkflow(source, filename) {
  const fail = (message) => { throw new Error(`${filename}: ${message}`); };
  // yaml 2.9.1 documents errors separately and rejects aliases with maxAliasCount: 0.
  // https://eemeli.org/yaml/#parsing-documents
  const document = parseDocument(source, { version: '1.2', strict: true, uniqueKeys: true });
  if (document.errors.length || document.warnings.length) fail('Invalid or ambiguous YAML');
  let workflow;
  try { workflow = document.toJS({ maxAliasCount: 0 }); }
  catch { fail('YAML aliases are not permitted in workflows'); }
  if (!isMap(workflow) || !equalMap(workflow.permissions, {})) fail('Root permissions must be {}');

  function inspect(value, key = '') {
    if (key === 'secrets') fail('Secrets are not permitted');
    if (typeof value === 'string') {
      if (/\bsecrets\s*[.[]/i.test(value)) fail('Secret references are not permitted');
      if (key === 'run') {
        if (value.includes('${{')) fail('Expression interpolation in run is not permitted');
        for (const line of value.split('\n')) {
          if (/\bnpm\s+(?:ci|install|i)\b/.test(line) && !/--ignore-scripts(?:\s|$)/.test(line)) {
            fail('npm installation must use --ignore-scripts');
          }
        }
      }
      if (key.endsWith('_IMAGE') && !/@sha256:[a-f0-9]{64}$/.test(value)) fail('Container images must be digest-pinned');
    } else if (Array.isArray(value)) value.forEach((item) => inspect(item));
    else if (isMap(value)) for (const [childKey, child] of Object.entries(value)) inspect(child, childKey);
  }
  inspect(workflow);
  const publishing = filename === 'site.yml';
  const allowedEvents = ['push', 'pull_request', 'workflow_dispatch', ...(publishing ? ['schedule'] : [])];
  if (!isMap(workflow.on) || Object.keys(workflow.on).some((event) => !allowedEvents.includes(event))) {
    fail('Unsupported workflow trigger; only publication may run on a schedule');
  }
  if (!isMap(workflow.jobs) || !Object.keys(workflow.jobs).length) fail('Workflow requires jobs');

  if (publishing) {
    if (Object.keys(workflow.on).sort().join(',') !== 'push,schedule,workflow_dispatch'
      || JSON.stringify(workflow.on.push?.branches) !== '["main"]') fail('Publication triggers must target main');
    if (JSON.stringify(workflow.on.schedule) !== '[{"cron":"23 * * * *"}]') fail('Brand release schedule must check hourly');
    if (Object.keys(workflow.jobs).sort().join(',') !== 'build,deploy') fail('Publication requires only build and deploy jobs');
    if (workflow.jobs.build.if !== "github.ref == 'refs/heads/main'") fail('Publication build must gate manual runs to main');
    if (!workflow.jobs.build.steps?.some((step) => step.run === 'bash scripts/build.sh --publish')) {
      fail('Publication must run the --publish preparation gate');
    }
    const required = ['node scripts/update-brand.mjs', 'node scripts/update-map.mjs', 'npm ci --ignore-scripts', 'npm run check', 'bash scripts/build.sh --publish'];
    let previous = -1;
    for (const command of required) {
      const index = workflow.jobs.build.steps.findIndex((step) => step.run === command);
      if (index < 0) fail('Publication requires the release resolver, installation, checks and build');
      if (index <= previous) fail('Release resolution must run before installation, checks and build, in that order');
      const step = workflow.jobs.build.steps[index];
      if (step.if !== undefined || step['continue-on-error'] !== undefined) fail('Release checks must be unconditional and stop on failure');
      previous = index;
    }
    if (workflow.jobs.build['continue-on-error'] !== undefined) fail('Build must stop on failure');
  }

  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (!isMap(job) || job.uses) fail('Reusable workflow jobs are not permitted');
    const deployment = publishing && name === 'deploy';
    if (deployment) {
      if (!equalMap(job.permissions, { pages: 'write', 'id-token': 'write' })) fail('Deploy permissions must be only pages/id-token write');
      if (job.needs !== 'build') fail('Deploy needs the successful build');
      if ((isMap(job.environment) ? job.environment.name : job.environment) !== 'github-pages') fail('Deploy must use github-pages');
      if (job.steps?.length !== 1 || !job.steps[0].uses?.startsWith('actions/deploy-pages@') || job.steps[0].run) {
        fail('Deploy may only invoke deploy-pages once');
      }
    } else if (!equalMap(job.permissions, { contents: 'read' })) fail('Build/check permissions must be only contents read');

    if (!Array.isArray(job.steps) || !job.steps.length) fail(`${name} requires steps`);
    for (const step of job.steps) {
      if (!step.uses) continue;
      if (!actionPin.test(step.uses)) fail('Every action must be GitHub-owned actions/* and pinned to a full commit SHA');
      const annotated = source.split('\n').some((line) => line.includes(step.uses) && /#\s*v\d+\.\d+\.\d+\s*$/.test(line));
      if (!annotated) fail(`Action ${step.uses.split('@')[0]} needs a version comment`);
      if (step.uses.startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) fail('Checkout must not persist credentials');
      if (step.uses.startsWith('actions/deploy-pages@') && !deployment) fail('deploy-pages belongs only in the isolated deploy job');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const directory = resolve('.github/workflows');
    const names = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
    for (const name of names) validateWorkflow(await readFile(resolve(directory, name), 'utf8'), name);
    console.log(`Checked ${names.length} workflows`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
