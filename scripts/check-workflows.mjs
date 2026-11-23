import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';
import { generatedCheckCommand, validateImportCaller, validateImportBranchPolicy, validateImportCi } from './check-docs-import-workflows.mjs';
import collector from '../data/workflow-map/collector.json' with { type: 'json' };

const actionPin = /^actions\/[a-z0-9-]+@[a-f0-9]{40}$/;
const isMap = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const equalMap = (value, expected) => isMap(value)
  && Object.keys(value).length === Object.keys(expected).length
  && Object.entries(expected).every(([key, item]) => value[key] === item);

export function validateMapsRegistration(registry) {
  const required = [
    { id: 'organisation', generator: 'scripts/update-map.mjs', outputs: ['data/org-map/repos.json', 'data/org-map/source.json'] },
    { id: 'workflows', generator: 'scripts/update-workflow-map.mjs', outputs: ['data/workflow-map/catalogue.json'] },
  ];
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.maps)) throw new Error('Invalid maps registry');
  for (const expected of required) {
    const matches = registry.maps.filter(map => map?.id === expected.id);
    const map = matches[0];
    if (matches.length !== 1 || map.generator !== expected.generator
      || JSON.stringify(map.arguments) !== '[]'
      || JSON.stringify(map.outputs) !== JSON.stringify(expected.outputs)) {
      throw new Error(`Maps registry must refresh the ${expected.id} map and its required outputs`);
    }
  }
  // The shared runner validates the full registry, paths and outputs at refresh time.
}

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
  const publishing = filename === 'site.yml';
  const scheduling = filename === 'site-refresh.yml';
  const importing = filename === 'docs-import.yml';
  const resolvers = filename === 'ci.yml' ? [generatedCheckCommand] : ['node scripts/update-brand.mjs'];
  const tokenEnvironment = { DOCS_GITHUB_TOKEN: '${{ github.token }}' };
  const resolverEnvironments = new Set((publishing || filename === 'ci.yml') && Array.isArray(workflow.jobs?.build?.steps)
    ? workflow.jobs.build.steps.filter((step) => resolvers.includes(step?.run)).map((step) => step.env) : []);

  function inspect(value, key = '', resolverEnvironment = false) {
    if (key === 'secrets') fail('Secrets are not permitted');
    if (typeof value === 'string') {
      if (/\bsecrets\s*[.[]/i.test(value)) fail('Secret references are not permitted');
      // The full context includes github.token, including when serialized for debugging.
      // https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#github-context
      if (value.includes('${{') && /\bgithub\b(?!\s*(?:\.|\[))|\bgithub\s*\.\s*\*/i.test(value)) {
        fail('The full GitHub context exposes the job token');
      }
      if (/\bgithub\s*(?:\.\s*token\b|\[\s*['"]token['"]\s*\])/i.test(value)
        && !(resolverEnvironment && key === 'DOCS_GITHUB_TOKEN' && value === tokenEnvironment.DOCS_GITHUB_TOKEN)) {
        fail('The job token belongs only in the resolver step environment');
      }
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
    else if (isMap(value)) for (const [childKey, child] of Object.entries(value)) inspect(child, childKey, resolverEnvironments.has(value));
  }
  inspect(workflow);
  const allowedEvents = ['push', 'pull_request', 'workflow_dispatch', ...((scheduling || importing) ? ['schedule'] : [])];
  if (!isMap(workflow.on) || Object.keys(workflow.on).some((event) => !allowedEvents.includes(event))) {
    fail('Unsupported workflow trigger; only the fixed site timer may run on a schedule');
  }
  if (!isMap(workflow.jobs) || !Object.keys(workflow.jobs).length) fail('Workflow requires jobs');

  if (scheduling) {
    const refresh = workflow.jobs.refresh;
    if (Object.keys(workflow).sort().join(',') !== 'concurrency,jobs,name,on,permissions'
      || Object.keys(workflow.on).sort().join(',') !== 'schedule,workflow_dispatch'
      || workflow.on.workflow_dispatch !== null
      || JSON.stringify(workflow.on.schedule) !== '[{"cron":"23 * * * *"}]'
      || !equalMap(workflow.concurrency, { group: 'site-refresh', 'cancel-in-progress': false })
      || Object.keys(workflow.jobs).join(',') !== 'refresh'
      || !isMap(refresh) || Object.keys(refresh).sort().join(',') !== 'if,permissions,uses'
      || refresh.if !== "github.ref == 'refs/heads/main'"
      || !equalMap(refresh.permissions, { contents: 'read', actions: 'write' })
      || !/^unset-sh\/tooling\/\.github\/workflows\/automation-docs-map-schedule\.yml@[a-f0-9]{40}$/.test(refresh.uses)) {
      fail('Site refresh must be the fixed hourly main timer and pinned central dispatcher');
    }
    return;
  }

  if (importing) { validateImportCaller(workflow, fail); return; }
  if (filename === 'branch-policy.yml') { validateImportBranchPolicy(workflow, fail); return; }
  if (filename === 'ci.yml') validateImportCi(workflow, fail);

  if (publishing) {
    if (Object.keys(workflow.on).sort().join(',') !== 'push,workflow_dispatch'
      || JSON.stringify(workflow.on.push?.branches) !== '["main"]') fail('Publication triggers must target main');
    if (Object.keys(workflow.jobs).sort().join(',') !== 'build,deploy,maps') fail('Publication requires maps, build and deploy jobs');
    const maps = workflow.jobs.maps;
    if (maps?.if !== "github.ref == 'refs/heads/main'") fail('Map refresh must gate manual runs to main');
    if (collector.repository !== 'unset-sh/tooling' || !/^[a-f0-9]{40}$/.test(collector.commit)
      || !isMap(maps) || Object.keys(maps).sort().join(',') !== 'if,permissions,uses,with'
      || maps.uses !== `${collector.repository}/.github/workflows/automation-maps-refresh.yml@${collector.commit}`
      || !equalMap(maps.with, { registry: '.github/maps.json', install: true })
      || !equalMap(maps.permissions, { contents: 'read' })) {
      fail('Map refresh must call only the reviewed shared workflow with its fixed registry and read-only permissions');
    }
    if (workflow.jobs.build.needs !== 'maps') fail('Build needs the successful map refresh');
    if (workflow.jobs.build.if !== "github.ref == 'refs/heads/main'") fail('Publication build must gate manual runs to main');
    if (!workflow.jobs.build.steps?.some((step) => step.run === 'bash scripts/build.sh --publish')) {
      fail('Publication must run the --publish preparation gate');
    }
    const required = ['node scripts/update-brand.mjs', 'npm ci --ignore-scripts', 'npm run check', 'bash scripts/build.sh --publish'];
    let previous = -1;
    for (const command of required) {
      const index = workflow.jobs.build.steps.findIndex((step) => step.run === command);
      if (index < 0) fail('Publication requires the release resolver, installation, checks and build');
      if (index <= previous) fail('Release resolution must run before installation, checks and build, in that order');
      const step = workflow.jobs.build.steps[index];
      if (step.if !== undefined || step['continue-on-error'] !== undefined) fail('Release checks must be unconditional and stop on failure');
      if (resolvers.includes(command) && !equalMap(step.env, tokenEnvironment)) {
        fail('Resolver environment must contain only the built-in read-only job token');
      }
      previous = index;
    }
    const steps = workflow.jobs.build.steps;
    const downloads = steps.filter(step => step.uses?.startsWith('actions/download-artifact@'));
    if (downloads.length !== 1) fail('Publication requires one validated map artifact');
    const download = downloads[0];
    if (download.uses !== 'actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333'
      || !equalMap(download.with, { name: '${{ needs.maps.outputs.artifact-name }}', path: '.' })
      || Object.keys(download).some(key => !['name', 'uses', 'with'].includes(key))) {
      fail('Map artifact must come from the successful shared refresh in this run');
    }
    const downloadIndex = steps.indexOf(download);
    if (downloadIndex <= steps.findIndex(step => step.run === 'npm ci --ignore-scripts')
      || downloadIndex >= steps.findIndex(step => step.run === 'npm run check')) {
      fail('Map artifact must be downloaded after installation and before checks');
    }
    if (steps.some(step => step.with?.repository !== undefined || step.with?.path === '.build/tooling')) {
      fail('Map helper checkout belongs in the shared refresh job');
    }
    if (workflow.jobs.build['continue-on-error'] !== undefined) fail('Build must stop on failure');
  }

  for (const [name, job] of Object.entries(workflow.jobs)) {
    if (!isMap(job)) fail('Each job must be a mapping');
    if (publishing && name === 'maps') continue;
    if (job.uses) fail('Reusable workflow jobs are permitted only for the shared map refresh');
    const deployment = publishing && name === 'deploy';
    if (deployment) {
      if (!equalMap(job.permissions, { pages: 'write', 'id-token': 'write' })) fail('Deploy permissions must be only pages/id-token write');
      if (job.needs !== 'build') fail('Deploy needs the successful build');
      if ((isMap(job.environment) ? job.environment.name : job.environment) !== 'github-pages') fail('Deploy must use github-pages');
      if (job.steps?.length !== 1 || !job.steps[0].uses?.startsWith('actions/deploy-pages@') || job.steps[0].run) {
        fail('Deploy may only invoke deploy-pages once');
      }
    } else if (!equalMap(job.permissions, filename === 'ci.yml' ? { contents: 'read', 'pull-requests': 'read' } : { contents: 'read' })) fail('Build/check permissions must be only contents read');

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
    validateMapsRegistration(JSON.parse(await readFile('.github/maps.json', 'utf8')));
    const directory = resolve('.github/workflows');
    const names = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
    for (const name of names) validateWorkflow(await readFile(resolve(directory, name), 'utf8'), name);
    console.log(`Checked ${names.length} workflows`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
