import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWorkflowView } from '../scripts/workflow-view.mjs';

const sha = 'a'.repeat(40);
const oldSha = 'b'.repeat(40);
const currentId = `unset-sh/tooling/.github/workflows/ci.yml@${sha}`;
const oldId = `unset-sh/tooling/.github/workflows/ci.yml@${oldSha}`;

function fixture() {
  return {
    schemaVersion: 1, organisation: 'unset-sh', collectedAt: '2026-11-22T12:00:00.000Z',
    collector: { repository: 'unset-sh/tooling', commit: sha },
    descriptions: { repository: 'unset-sh/tooling', commit: sha, sha256: 'e'.repeat(64) },
    repositories: [
      { name: 'tooling', defaultBranch: 'main', commit: sha, archived: false, workflowIds: [currentId] },
      { name: 'empty', defaultBranch: null, commit: null, archived: true, workflowIds: [] },
    ],
    workflows: [{
      id: currentId, repository: 'tooling', path: '.github/workflows/ci.yml', commit: sha,
      sha256: 'c'.repeat(64), name: 'CI', current: true,
      documentation: { status: 'missing', purpose: null, steps: [], outputs: [], reviewedCommit: null, reviewedSha256: null },
      events: [{ name: 'push', config: { branches: ['main'], paths: ['src/**'] } }],
      permissions: { contents: 'read' },
      jobs: [{ id: 'check', name: 'Check', needs: [], condition: null, permissions: null, environment: null, uses: null }],
    }],
    calls: [],
  };
}

function withCall() {
  const data = fixture();
  data.workflows[0].jobs[0].uses = `unset-sh/tooling/.github/workflows/ci.yml@${oldSha}`;
  const target = structuredClone(data.workflows[0]);
  Object.assign(target, { id: oldId, commit: oldSha, current: false, events: [{ name: 'workflow_call', config: null }] });
  target.jobs[0].uses = null;
  data.workflows.push(target);
  data.calls.push({ callerId: currentId, jobId: 'check', targetId: oldId,
    reference: data.workflows[0].jobs[0].uses, resolution: 'commit', status: 'resolved' });
  return data;
}

test('accepts isolated repositories and distinguishes a historical pinned callee', () => {
  assert.equal(validateWorkflowView(fixture()).repositories.length, 2);
  const data = withCall();
  assert.equal(validateWorkflowView(data).workflows.filter(workflow => !workflow.current).length, 1);
});

test('shows reviewed descriptions only with an honest source-match status', () => {
  const data = fixture();
  const documentation = { status: 'current', purpose: 'Check the consuming repository.',
    steps: ['Install locked dependencies.', 'Run the configured checks.'], outputs: ['A check result.'],
    reviewedCommit: oldSha, reviewedSha256: data.workflows[0].sha256 };
  data.workflows[0].documentation = documentation;
  assert.doesNotThrow(() => validateWorkflowView(data));
  documentation.status = 'review';
  assert.throws(() => validateWorkflowView(data), /description|documentation/i);
  documentation.reviewedSha256 = 'd'.repeat(64);
  assert.doesNotThrow(() => validateWorkflowView(data));
  for (const change of [
    item => { item.status = 'current'; },
    item => { item.status = 'missing'; },
    item => { item.reviewedCommit = 'main'; },
    item => { item.steps = []; },
    item => { item.purpose = 'x'.repeat(2001); },
    item => { item.outputs = ['A result.\nUnreviewed extra line']; },
  ]) {
    const copy = structuredClone(data); change(copy.workflows[0].documentation);
    assert.throws(() => validateWorkflowView(copy));
  }
});

test('accepts cycles in reusable calls without pretending they form a repository DAG', () => {
  const data = withCall();
  data.workflows[1].jobs[0].uses = `unset-sh/tooling/.github/workflows/ci.yml@${sha}`;
  data.calls.push({ callerId: oldId, jobId: 'check', targetId: currentId,
    reference: data.workflows[1].jobs[0].uses, resolution: 'commit', status: 'resolved' });
  assert.equal(validateWorkflowView(data).calls.length, 2);
});

test('rejects source identifiers that could produce unsafe or misleading links', () => {
  for (const change of [
    data => { data.repositories[0].name = '../other'; },
    data => { data.workflows[0].repository = 'outside'; },
    data => { data.workflows[0].path = '.github/workflows/../secret.yml'; },
    data => { data.workflows[0].commit = 'main'; },
    data => { data.workflows[0].sha256 = 'unverified'; },
    data => { data.workflows[0].id = `${currentId}/spoof`; },
    data => { data.collector.repository = 'outside/tooling'; },
    data => { data.collector.commit = 'main'; },
    data => { data.collectedAt = 'not a timestamp'; },
  ]) {
    const data = fixture(); change(data);
    assert.throws(() => validateWorkflowView(data), /Workflow catalogue:/);
  }
});

test('rejects incorrect current membership, duplicate identities and empty-repository contradictions', () => {
  for (const change of [
    data => { data.repositories[0].workflowIds = []; },
    data => { data.repositories[0].workflowIds.push(currentId); },
    data => { data.repositories[0].commit = oldSha; },
    data => { data.workflows[0].current = false; },
    data => { data.workflows.push(structuredClone(data.workflows[0])); },
    data => { data.repositories.push(structuredClone(data.repositories[0])); },
    data => { data.repositories[1].workflowIds = [currentId]; },
    data => { data.repositories[0].defaultBranch = null; },
  ]) {
    const data = fixture(); change(data);
    assert.throws(() => validateWorkflowView(data), /Workflow catalogue:/);
  }
});

test('rejects broken job dependencies and call edges', () => {
  for (const change of [
    data => { data.workflows[0].jobs[0].needs = ['missing']; },
    data => { data.workflows[0].jobs[0].needs = ['check']; },
    data => { data.calls[0].callerId = 'missing'; },
    data => { data.calls[0].targetId = 'missing'; },
    data => { data.calls[0].jobId = 'missing'; },
    data => { data.calls[0].reference = './.github/workflows/other.yml'; },
    data => { data.calls[0].status = 'external'; },
    data => { data.calls.push(structuredClone(data.calls[0])); },
    data => { data.calls = []; },
  ]) {
    const data = withCall(); change(data);
    assert.throws(() => validateWorkflowView(data), /Workflow catalogue:/);
  }
});

test('keeps an unresolved call explicit without making its reference a URL', () => {
  const data = fixture();
  data.workflows[0].jobs[0].uses = 'outside/repo/.github/workflows/ci.yml@v1';
  data.calls.push({ callerId: currentId, jobId: 'check', targetId: null,
    reference: data.workflows[0].jobs[0].uses, resolution: 'external', status: 'external' });
  assert.equal(validateWorkflowView(data).calls[0].targetId, null);
});

test('bounds text, collections and trigger filters before rendering', () => {
  for (const change of [
    data => { data.workflows[0].name = 'x'.repeat(8193); },
    data => { data.workflows[0].name = 'hidden\u0000text'; },
    data => { data.repositories = Array(201).fill(data.repositories[0]); },
    data => { data.workflows[0].events[0].config = { env: { SECRET: 'value' } }; },
    data => { data.workflows[0].events[0].config = { branches: [3] }; },
    data => { data.workflows[0].permissions = { contents: 'owner' }; },
    data => { data.workflows[0].jobs[0].needs = Array(257).fill('check'); },
  ]) {
    const data = fixture(); change(data);
    assert.throws(() => validateWorkflowView(data), /Workflow catalogue:/);
  }
});


test('description data can advance independently of code while matching collected tooling', () => {
  const data = fixture();
  data.collector.commit = oldSha;
  assert.doesNotThrow(() => validateWorkflowView(data));
  for (const change of [
    item => { item.descriptions.repository = 'outside/tooling'; },
    item => { item.descriptions.commit = oldSha; },
    item => { item.descriptions.commit = 'main'; },
    item => { item.descriptions.sha256 = 'unverified'; },
    item => { delete item.descriptions; },
  ]) {
    const copy = structuredClone(data); change(copy);
    assert.throws(() => validateWorkflowView(copy));
  }
});
