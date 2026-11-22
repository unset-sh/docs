import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkWorkflowMap, parseWorkflowYaml, refreshWorkflowMap } from '../scripts/update-workflow-map.mjs';

const commit = 'a'.repeat(40);
const fixture = () => ({ schemaVersion: 1, organisation: 'unset-sh', collectedAt: '2026-11-22T12:00:00.000Z',
  collector: { repository: 'unset-sh/tooling', commit },
  repositories: [{ name: 'empty', defaultBranch: null, commit: null, archived: false, workflowIds: [] }],
  workflows: [], calls: [] });
async function directory(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'workflow-snapshot-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('parses real YAML events, scalar needs and bounded aliases without executing expressions', () => {
  const source = `name: Test
on: [push, workflow_dispatch]
jobs:
  check: &job
    runs-on: ubuntu-latest
    if: \${{ inputs.enabled }}
    steps: [{run: 'echo harmless'}]
  follow:
    needs: check
    steps: *job
`;
  const value = parseWorkflowYaml(source);
  assert.deepEqual(value.on, ['push', 'workflow_dispatch']);
  assert.equal(value.jobs.follow.needs, 'check');
  assert.equal(value.jobs.check.if, '${{ inputs.enabled }}');
  assert.equal(value.jobs.follow.steps['runs-on'], 'ubuntu-latest');
});

test('rejects ambiguous, malformed, oversized and cyclic YAML with safe diagnostics', () => {
  for (const source of ['on: push\non: pull_request', 'jobs: [', 'x: !unsafe value', 'x: &x [*x]', ' '.repeat(1_048_577)]) {
    assert.throws(() => parseWorkflowYaml(source), error => {
      assert.match(error.message, /workflow YAML/i);
      assert.doesNotMatch(error.message, /!unsafe|pull_request/);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('accepts a UTF-8 BOM and CRLF without changing workflow meaning', () => {
  const source = '\ufeffname: Check\r\non: push\r\njobs:\r\n  check:\r\n    steps: []\r\n';
  assert.deepEqual(parseWorkflowYaml(source), { name: 'Check', on: 'push', jobs: { check: { steps: [] } } });
});

test('stores a validated catalogue atomically and checks it offline', async t => {
  const destination = await directory(t);
  let invoked = 0;
  await refreshWorkflowMap({ directory: destination, collectorCommit: commit, githubToken: 'fixture-token', collect: async options => {
    invoked++;
    assert.equal(options.githubToken, 'fixture-token');
    assert.equal(options.parseYaml, parseWorkflowYaml);
    return fixture();
  } });
  assert.equal(invoked, 1);
  assert.deepEqual(await checkWorkflowMap(destination), fixture());
  assert.doesNotMatch(await readFile(path.join(destination, 'catalogue.json'), 'utf8'), /fixture-token/);
});

test('failed collection, validation and provenance leave the previous snapshot intact', async t => {
  const destination = await directory(t);
  await refreshWorkflowMap({ directory: destination, collectorCommit: commit, collect: async () => fixture() });
  const before = await readFile(path.join(destination, 'catalogue.json'));
  for (const collect of [
    async () => { throw new Error('Authorization: fixture-token'); },
    async () => ({ ...fixture(), organisation: 'elsewhere' }),
    async () => ({ ...fixture(), collector: { repository: 'unset-sh/tooling', commit: 'b'.repeat(40) } }),
  ]) {
    await assert.rejects(refreshWorkflowMap({ directory: destination, collectorCommit: commit, collect }), error => {
      assert.doesNotMatch(error.message, /fixture-token|Authorization/);
      return true;
    });
    assert.deepEqual(await readFile(path.join(destination, 'catalogue.json')), before);
  }
});

test('refuses linked destinations and oversized offline input', async t => {
  const destination = await directory(t);
  const outside = path.join(destination, 'outside');
  await writeFile(outside, 'unchanged');
  const output = path.join(destination, 'catalogue.json');
  await symlink(outside, output);
  await assert.rejects(refreshWorkflowMap({ directory: destination, collectorCommit: commit, collect: async () => fixture() }), /regular|symlink/i);
  assert.equal(await readFile(outside, 'utf8'), 'unchanged');
  await rm(output);
  await writeFile(output, ' '.repeat(4_194_305));
  await assert.rejects(checkWorkflowMap(destination), /size|large/i);
});
