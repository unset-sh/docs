const commitPattern = /^[a-f0-9]{40}$/;
const namePattern = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;
const filters = new Set(['branches', 'branches-ignore', 'tags', 'tags-ignore', 'paths', 'paths-ignore', 'types', 'workflows']);
const resolutions = new Set(['local', 'commit', 'tag', 'branch', 'external', 'missing', 'invalid']);
const fail = message => { throw new Error(`Workflow catalogue: ${message}`); };

function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object');
}
function text(value, max = 8192) {
  if (typeof value !== 'string' || !value.trim() || value.length > max
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('invalid text');
}
function array(value, max) {
  if (!Array.isArray(value) || value.length > max) fail('invalid or oversized collection');
}
function commit(value) {
  if (typeof value !== 'string' || !commitPattern.test(value)) fail('invalid immutable revision');
}
function strings(value, max = 200) {
  array(value, max); value.forEach(item => text(item));
}
function permissions(value) {
  if (value === null || value === 'read-all' || value === 'write-all') return;
  object(value);
  if (Object.keys(value).length > 100) fail('too many declared permissions');
  for (const [scope, access] of Object.entries(value)) {
    if (!/^[a-z][a-z-]{0,8191}$/.test(scope) || !['none', 'read', 'write'].includes(access)) fail('invalid declared permissions');
  }
}
function events(value) {
  array(value, 200);
  if (!value.length) fail('workflow has no events');
  const names = new Set();
  for (const event of value) {
    object(event);
    if (typeof event.name !== 'string' || !/^[a-z][a-z0-9_]{0,8191}$/.test(event.name) || names.has(event.name)) fail('invalid or repeated event');
    names.add(event.name);
    if (event.config === null) continue;
    if (event.name === 'schedule') { strings(event.config); continue; }
    object(event.config);
    for (const [filter, values] of Object.entries(event.config)) {
      if (!filters.has(filter)) fail('unsupported event filter');
      strings(values);
    }
  }
}

function documentation(value, sourceDigest) {
  object(value);
  if (!['current', 'review', 'missing'].includes(value.status)) fail('invalid description status');
  array(value.steps, 20); array(value.outputs, 10);
  if (value.status === 'missing') {
    if (value.purpose !== null || value.reviewedCommit !== null || value.reviewedSha256 !== null
      || value.steps.length || value.outputs.length) fail('missing description contains unverified text');
    return;
  }
  if (!value.steps.length || !value.outputs.length) fail('description requires steps and outputs');
  for (const line of [value.purpose, ...value.steps, ...value.outputs]) {
    text(line, 2000);
    if (line !== line.trim() || /[\r\n]/.test(line)) fail('description requires single-line text');
  }
  commit(value.reviewedCommit);
  if (typeof value.reviewedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.reviewedSha256)
    || (value.status === 'current') !== (value.reviewedSha256 === sourceDigest)) fail('description does not match its source status');
}

// This is a view boundary, not another YAML extractor. It runs without network
// access or the tooling checkout so committed snapshots remain usable offline.
export function validateWorkflowView(catalogue) {
  object(catalogue);
  if (catalogue.schemaVersion !== 1 || catalogue.organisation !== 'unset-sh') fail('unsupported schema or organisation');
  text(catalogue.collectedAt, 30);
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(catalogue.collectedAt)
    || !Number.isFinite(Date.parse(catalogue.collectedAt))) fail('invalid collection timestamp');
  object(catalogue.collector);
  if (catalogue.collector.repository !== 'unset-sh/tooling') fail('unexpected collector repository');
  commit(catalogue.collector.commit);
  object(catalogue.descriptions);
  if (catalogue.descriptions.repository !== 'unset-sh/tooling') fail('unexpected description repository');
  commit(catalogue.descriptions.commit);
  if (typeof catalogue.descriptions.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(catalogue.descriptions.sha256)) {
    fail('invalid description registry digest');
  }
  array(catalogue.repositories, 200); array(catalogue.workflows, 2000); array(catalogue.calls, 10000);
  if (!catalogue.repositories.length) fail('repository inventory is empty');

  const repositories = new Map();
  for (const repo of catalogue.repositories) {
    object(repo);
    if (typeof repo.name !== 'string' || !namePattern.test(repo.name)
      || repositories.has(repo.name.toLowerCase())) fail('invalid or repeated repository');
    repositories.set(repo.name.toLowerCase(), repo);
    if (repo.defaultBranch !== null) text(repo.defaultBranch, 1024);
    if (repo.commit !== null) {
      commit(repo.commit);
      if (repo.defaultBranch === null) fail('resolved repository has no default branch');
    }
    if (typeof repo.archived !== 'boolean') fail('invalid archived state');
    strings(repo.workflowIds, 2000);
    if (new Set(repo.workflowIds).size !== repo.workflowIds.length) fail('repeated repository workflow');
    if (repo.commit === null && repo.workflowIds.length) fail('empty repository contains workflows');
  }

  if (repositories.get('tooling')?.commit !== catalogue.descriptions.commit) {
    fail('description registry must use the collected tooling revision');
  }

  const workflows = new Map();
  const jobsByWorkflow = new Map();
  for (const workflow of catalogue.workflows) {
    object(workflow);
    const repo = typeof workflow.repository === 'string' && repositories.get(workflow.repository.toLowerCase());
    if (!repo || repo.name !== workflow.repository) fail('unknown workflow repository');
    text(workflow.path, 1024);
    if (!/^\.github\/workflows\/[^/\\\r\n]+\.ya?ml$/.test(workflow.path) || workflow.path.slice(18).length > 255) fail('invalid workflow path');
    commit(workflow.commit);
    if (workflow.id !== `unset-sh/${workflow.repository}/${workflow.path}@${workflow.commit}` || workflows.has(workflow.id)) {
      fail('invalid or repeated workflow identity');
    }
    if (typeof workflow.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(workflow.sha256)) fail('invalid source digest');
    documentation(workflow.documentation, workflow.sha256);
    text(workflow.name); events(workflow.events); permissions(workflow.permissions);
    if (typeof workflow.current !== 'boolean' || workflow.current !== (workflow.commit === repo.commit)) fail('incorrect workflow revision state');
    if (repo.workflowIds.includes(workflow.id) !== workflow.current) fail('incorrect current workflow membership');
    workflows.set(workflow.id, workflow);
    array(workflow.jobs, 256);
    const jobs = new Map();
    for (const job of workflow.jobs) {
      object(job);
      if (typeof job.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,8191}$/.test(job.id) || jobs.has(job.id)) fail('invalid or repeated job');
      text(job.name); strings(job.needs, 256); permissions(job.permissions);
      for (const field of ['condition', 'environment', 'uses']) if (job[field] !== null) text(job[field]);
      if (new Set(job.needs).size !== job.needs.length) fail('repeated job dependency');
      jobs.set(job.id, job);
    }
    for (const job of workflow.jobs) for (const need of job.needs) {
      if (!jobs.has(need) || need === job.id) fail('unknown or self-referencing job dependency');
    }
    jobsByWorkflow.set(workflow.id, jobs);
  }
  for (const repo of catalogue.repositories) for (const id of repo.workflowIds) {
    const workflow = workflows.get(id);
    if (!workflow || workflow.repository !== repo.name || !workflow.current) fail('invalid repository workflow membership');
  }

  const callers = new Set();
  for (const call of catalogue.calls) {
    object(call);
    const job = jobsByWorkflow.get(call.callerId)?.get(call.jobId);
    if (!job || job.uses === null || job.uses !== call.reference) fail('call does not match its caller job');
    const key = `${call.callerId}:${call.jobId}`;
    if (callers.has(key)) fail('repeated call from one job');
    callers.add(key);
    if (!resolutions.has(call.resolution)) fail('unknown call resolution');
    if (call.status === 'resolved') {
      if (!['local', 'commit', 'tag', 'branch'].includes(call.resolution) || !workflows.has(call.targetId)) fail('invalid resolved call');
    } else if (!['external', 'missing', 'invalid'].includes(call.status)
      || call.resolution !== call.status || call.targetId !== null) fail('invalid unresolved call');
  }
  for (const [id, jobs] of jobsByWorkflow) for (const job of jobs.values()) {
    if (job.uses !== null && !callers.has(`${id}:${job.id}`)) fail('reusable call is missing from the map');
  }
  return catalogue;
}
