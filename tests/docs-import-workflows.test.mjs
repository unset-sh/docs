import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { validateWorkflow } from '../scripts/check-workflows.mjs';

const sources = Object.fromEntries(['ci.yml', 'branch-policy.yml', 'docs-import.yml'].map(name => [name,
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')]));
// Preserve version comments when mutating the parsed workflow fixture.
const annotated = workflow => stringify(workflow).replace(/(uses: actions\/([^@]+)@[a-f0-9]{40})/g,
  (line, _, action) => `${line} # v${action === 'checkout' ? '7.0.1' : '7.1.0'}`);

test('the real receiver and both required check adapters satisfy their fixed contracts', () => {
  for (const [name, source] of Object.entries(sources)) assert.doesNotThrow(() => validateWorkflow(source, name));
});

test('generated documentation checks cannot skip proof, execute a consumer first or replace the required checks', () => {
  for (const mutate of [
    value => { delete value.on.workflow_dispatch; },
    value => { delete value.on.workflow_dispatch.inputs['expected-head']; },
    value => { value.on.workflow_dispatch.inputs['pull-request'].required = false; },
    value => { value.jobs.build.if = 'false'; },
    value => { value.jobs.build['continue-on-error'] = true; },
    value => { value.jobs.build.name = 'Another check'; },
    value => { value.jobs.build.permissions.contents = 'write'; },
    value => { value.jobs.build.steps[0].with.repository = 'other/tooling'; },
    value => { value.jobs.build.steps[0].with.ref = 'main'; },
    value => { value.jobs.build.steps[0].with['persist-credentials'] = true; },
    value => { value.jobs.build.steps[2].if = 'false'; },
    value => { value.jobs.build.steps[2]['continue-on-error'] = true; },
    value => { value.jobs.build.steps[2].env.EXPECTED_HEAD = '${{ github.sha }}'; },
    value => { value.jobs.build.steps[2].run = 'echo valid'; },
    value => { [value.jobs.build.steps[2], value.jobs.build.steps[3]] = [value.jobs.build.steps[3], value.jobs.build.steps[2]]; },
    value => { value.jobs.build.steps[3].with.ref = 'main'; },
    value => { value.jobs.build.steps[5].env = { TOKEN: '${{ github.token }}' }; },
    value => { value.jobs.build.steps[6].if = "github.event_name != 'workflow_dispatch'"; },
    value => { value.jobs.build.steps.pop(); },
  ]) {
    const workflow = parse(sources['ci.yml']); mutate(workflow);
    assert.throws(() => validateWorkflow(annotated(workflow), 'ci.yml'));
  }
});

test('the receiver cannot acquire another source, destination, schedule or permission', () => {
  for (const mutate of [
    value => { value.on.push = { branches: ['main'] }; },
    value => { value.on.schedule[0].cron = '* * * * *'; },
    value => { value.concurrency['cancel-in-progress'] = true; },
    value => { value.jobs.import.if = "github.ref == 'refs/heads/staging'"; },
    value => { value.jobs.import.strategy.matrix.source.push('outside'); },
    value => { value.jobs.import.with.source = 'outside'; },
    value => { value.jobs.import.uses = value.jobs.import.uses.replace(/@[a-f0-9]{40}/, '@main'); },
    value => { value.jobs.import.permissions.issues = 'write'; },
    value => { value.jobs.import.secrets = 'inherit'; },
    value => { value.jobs.import.steps = [{ run: 'npm run source' }]; },
  ]) {
    const workflow = parse(sources['docs-import.yml']); mutate(workflow);
    assert.throws(() => validateWorkflow(annotated(workflow), 'docs-import.yml'));
  }
  assert.throws(() => validateWorkflow(sources['docs-import.yml'], 'arbitrary.yml'));
});

test('branch policy forwards all identities and cannot silently accept an empty dispatch contract', () => {
  for (const mutate of [
    value => { delete value.on.workflow_dispatch; },
    value => { delete value.jobs.policy.with['expected-base']; },
    value => { value.jobs.policy.with['pull-request'] = '123'; },
    value => { value.jobs.policy.if = "github.event_name == 'pull_request'"; },
  ]) {
    const workflow = parse(sources['branch-policy.yml']); mutate(workflow);
    assert.throws(() => validateWorkflow(annotated(workflow), 'branch-policy.yml'));
  }
});
