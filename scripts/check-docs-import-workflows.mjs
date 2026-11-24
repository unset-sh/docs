// The receiver and its generated-PR adapters are deliberately fixed contracts.
// https://docs.github.com/en/actions/concepts/security/github_token
const map = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = value => map(value) ? Object.keys(value).sort().join(',') : '';
const same = (value, expected) => keys(value) === keys(expected) && Object.entries(expected).every(([key, item]) => value[key] === item);
export const generatedCheckCommand = 'node .build/import-helper/scripts/automation-dispatch.mjs --pull-request "$PULL_REQUEST" --expected-head "$EXPECTED_HEAD" --expected-base "$EXPECTED_BASE"';
const generatedIf = "github.event_name == 'workflow_dispatch'";
const forwardedInputs = { 'pull-request': "${{ inputs.pull-request || '' }}", 'expected-head': "${{ inputs.expected-head || '' }}", 'expected-base': "${{ inputs.expected-base || '' }}", flow: 'main' };
const checkEnvironment = { DOCS_GITHUB_TOKEN: '${{ github.token }}', PULL_REQUEST: '${{ inputs.pull-request }}', EXPECTED_HEAD: '${{ inputs.expected-head }}', EXPECTED_BASE: '${{ inputs.expected-base }}' };

// The sources tooling's pinned receiver knows (tooling docs/import-docs.md). A source is listed here only
// once its own main has a successful docs export; tooling and github stay first.
const importSources = new Set(['tooling', 'github', 'brand', 'rendering', 'lexicons', 'agent-kit', 'web', 'backend', 'deployment', 'pds', 'modules']);
const importMatrix = list => Array.isArray(list) && list[0] === 'tooling' && list[1] === 'github'
  && list.every(source => typeof source === 'string' && importSources.has(source)) && new Set(list).size === list.length;

function dispatchInputs(trigger, fail) {
  if (keys(trigger) !== 'inputs' || keys(trigger.inputs) !== 'expected-base,expected-head,pull-request'
    || Object.values(trigger.inputs).some(input => keys(input) !== 'description,required,type'
      || input.type !== 'string' || input.required !== true || typeof input.description !== 'string' || !input.description)) {
    fail('Generated check dispatch requires the fixed PR, expected head and expected base inputs');
  }
}

export function validateImportCaller(workflow, fail) {
  const job = workflow.jobs?.import;
  if (keys(workflow) !== 'concurrency,jobs,name,on,permissions' || keys(workflow.on) !== 'schedule,workflow_dispatch'
    || workflow.on.workflow_dispatch !== null || JSON.stringify(workflow.on.schedule) !== '[{"cron":"41 * * * *"}]'
    || !same(workflow.concurrency, { group: 'docs-import', 'cancel-in-progress': false }) || keys(workflow.jobs) !== 'import'
    || keys(job) !== 'if,permissions,strategy,uses,with' || job.if !== "github.ref == 'refs/heads/main'"
    || !/^unset-sh\/tooling\/\.github\/workflows\/automation-docs-import\.yml@[a-f0-9]{40}$/.test(job.uses)
    || !same(job.permissions, { contents: 'write', 'pull-requests': 'write', actions: 'write' })
    || !same(job.with, { source: '${{ matrix.source }}' }) || keys(job.strategy) !== 'fail-fast,matrix'
    || job.strategy['fail-fast'] !== false || keys(job.strategy.matrix) !== 'source'
    || !importMatrix(job.strategy.matrix.source)) {
    fail('Documentation import must use the fixed hourly main receiver and allowlisted source matrix');
  }
}

export function validateImportBranchPolicy(workflow, fail) {
  const policy = workflow.jobs.policy;
  dispatchInputs(workflow.on.workflow_dispatch, fail);
  if (keys(workflow) !== 'jobs,name,on,permissions' || keys(workflow.on) !== 'pull_request,workflow_dispatch'
    || keys(workflow.on.pull_request) !== 'types'
    || JSON.stringify(workflow.on.pull_request.types) !== '["opened","synchronize","reopened","edited","ready_for_review"]'
    || keys(workflow.jobs) !== 'policy' || keys(policy) !== 'permissions,uses,with'
    || !same(policy.permissions, { contents: 'read' }) || !same(policy.with, forwardedInputs)
    || !/^unset-sh\/tooling\/\.github\/workflows\/ci-branch-policy\.yml@[a-f0-9]{40}$/.test(policy.uses)) {
    fail('Branch policy must be an unconditional read-only pinned caller with fixed generated PR inputs');
  }
}

export function validateImportCi(workflow, fail) {
  dispatchInputs(workflow.on.workflow_dispatch, fail);
  const job = workflow.jobs.build, steps = job?.steps;
  if (keys(workflow) !== 'jobs,name,on,permissions' || keys(workflow.on) !== 'pull_request,push,workflow_dispatch'
    || keys(workflow.on.pull_request) !== 'types'
    || JSON.stringify(workflow.on.pull_request.types) !== '["opened","synchronize","reopened","edited","ready_for_review"]'
    || keys(workflow.on.push) !== 'branches' || JSON.stringify(workflow.on.push.branches) !== '["main"]'
    || keys(workflow.jobs) !== 'build' || keys(job) !== 'env,name,permissions,runs-on,steps,timeout-minutes'
    || job.name !== 'Validate documentation' || keys(job.env) !== 'ACTIONLINT_IMAGE'
    || !same(job.permissions, { contents: 'read', 'pull-requests': 'read' }) || !Array.isArray(steps) || steps.length !== 11) {
    fail('Documentation CI must retain its required name, triggers, read-only rights and complete checks');
  }
  const [helper, runtime, proof, checkout] = steps;
  if (keys(helper) !== 'if,name,uses,with' || helper.if !== generatedIf
    || helper.uses !== 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
    || keys(helper.with) !== 'path,persist-credentials,ref,repository' || helper.with.repository !== 'unset-sh/tooling'
    || !/^[a-f0-9]{40}$/.test(helper.with.ref) || helper.with.path !== '.build/import-helper' || helper.with['persist-credentials'] !== false
    || keys(runtime) !== 'if,name,uses,with' || runtime.if !== generatedIf
    || runtime.uses !== 'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1'
    || !same(runtime.with, { 'node-version': '26.12.0', 'package-manager-cache': false })
    || keys(proof) !== 'env,if,name,run' || proof.if !== generatedIf || proof.run !== generatedCheckCommand || !same(proof.env, checkEnvironment)
    || keys(checkout) !== 'uses,with' || checkout.uses !== helper.uses
    || !same(checkout.with, { ref: '${{ github.sha }}', 'persist-credentials': false, 'fetch-depth': 0 })) {
    fail('Generated documentation checks must verify the actual PR with a pinned helper before consumer checkout');
  }
  if (steps[4].uses !== runtime.uses || !same(steps[4].with, { 'node-version-file': '.nvmrc', 'package-manager-cache': false })
    || keys(steps[4]) !== 'uses,with') fail('Documentation runtime must follow verified consumer checkout');
  const commands = ['npm ci --ignore-scripts', 'npm run check', 'node scripts/check-docs-impact.mjs',
    'docker run --rm -v "$PWD:/repo" -w /repo "$ACTIONLINT_IMAGE" -color', 'bash scripts/build.sh', 'bash scripts/build.sh --preview'];
  for (const [index, command] of commands.entries()) {
    const step = steps[index + 5], impact = index === 2;
    if (step.run !== command || keys(step) !== (impact ? 'if,name,run' : 'name,run')
      || (impact && step.if !== "github.event_name == 'pull_request'")) fail('Documentation checks must stay complete, ordered and fail on errors');
  }
}
