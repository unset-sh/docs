import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWorkflow } from '../scripts/check-workflows.mjs';

const checkout = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const deploy = 'actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346';
const ci = `name: check
on:
  pull_request:
permissions: {}
jobs:
  build:
    runs-on: ubuntu-24.04
    permissions: {contents: read}
    steps:
      - uses: ${checkout} # v7.0.1
        with: {persist-credentials: false}
      - run: npm ci --ignore-scripts
      - run: npm run check
`;
const site = ci.replace('  pull_request:', '  push:\n    branches: [main]\n  workflow_dispatch:\n  schedule:\n    - cron: "23 * * * *"')
  .replace('    runs-on:', "    if: github.ref == 'refs/heads/main'\n    runs-on:")
  .replace('      - run: npm ci --ignore-scripts', '      - run: node scripts/update-brand.mjs\n      - run: node scripts/update-map.mjs\n      - run: npm ci --ignore-scripts')
  .replace('      - run: npm run check', '      - run: npm run check\n      - run: bash scripts/build.sh --publish') + `
  deploy:
    needs: build
    runs-on: ubuntu-24.04
    environment: github-pages
    permissions: {pages: write, id-token: write}
    steps:
      - id: deployment
        uses: ${deploy} # v5.0.1
`;

const tokenEnv = '\n        env:\n          DOCS_GITHUB_TOKEN: ${{ github.token }}';
const authenticatedSite = site.replace(/(- run: node scripts\/update-(?:brand|map)\.mjs)/g, `$1${tokenEnv}`);

test('accepts read-only PR validation and isolated Pages publication', () => {
  assert.doesNotThrow(() => validateWorkflow(ci, 'ci.yml'));
  assert.doesNotThrow(() => validateWorkflow(authenticatedSite, 'site.yml'));
});

for (const [name, source] of [
  ['anonymous production resolution', site],
  ['token at workflow scope', authenticatedSite.replace('permissions: {}', 'permissions: {}\nenv:\n  TOKEN: ${{ github.token }}')],
  ['token at job scope', authenticatedSite.replace('    steps:', '    env:\n      TOKEN: ${{ github.token }}\n    steps:')],
  ['token exposed to npm installation', authenticatedSite.replace('      - run: npm ci --ignore-scripts', `      - run: npm ci --ignore-scripts${tokenEnv}`)],
  ['bracket-style token outside the resolver', authenticatedSite.replace('      - run: npm run check', "      - run: npm run check\n        env:\n          TOKEN: ${{ github['token'] }}")],
  ['whole GitHub context exposed to npm', authenticatedSite.replace('      - run: npm ci --ignore-scripts', '      - run: npm ci --ignore-scripts\n        env:\n          GH_CONTEXT: ${{ toJSON(github) }}')],
  ['additional resolver token environment', authenticatedSite.replace('DOCS_GITHUB_TOKEN: ${{ github.token }}', 'DOCS_GITHUB_TOKEN: ${{ github.token }}\n          EXTRA_TOKEN: ${{ github.token }}')],
]) {
  test(`rejects ${name}`, () => assert.throws(() => validateWorkflow(source, 'site.yml'), /token|resolver.*environment/i));
}

for (const [name, source, match] of [
  ['write rights at workflow scope', ci.replace('permissions: {}', 'permissions: write-all'), /root permissions/i],
  ['implicit build rights', ci.replace('    permissions: {contents: read}\n', ''), /contents.*read/i],
  ['publish rights in a PR job', ci.replace('{contents: read}', '{contents: read, pages: write}'), /contents.*read/i],
  ['a mutable action tag', ci.replace(checkout, 'actions/checkout@v7'), /full.*SHA/i],
  ['a non-GitHub action', ci.replace(checkout, 'other/checkout@' + 'a'.repeat(40)), /actions\/|GitHub-owned/i],
  ['persisted checkout credentials', ci.replace('persist-credentials: false', 'persist-credentials: true'), /credentials/i],
  ['expression interpolation in a block shell script', ci.replace('npm run check', '|\n          echo "${{ github.event.pull_request.title }}"'), /expression.*run/i],
  ['secret in environment', ci.replace('    steps:', '    env:\n      TOKEN: ${{ secrets.READ_TOKEN }}\n    steps:'), /secret/i],
  ['bracket-style secret access', ci.replace('    steps:', "    env:\n      TOKEN: ${{ secrets['READ_TOKEN'] }}\n    steps:"), /secret/i],
  ['lifecycle scripts during installation', ci.replace('npm ci --ignore-scripts', 'npm ci'), /ignore-scripts/i],
  ['duplicate YAML permission keys', ci.replace('permissions: {}', 'permissions: {}\npermissions: write-all'), /YAML/i],
  ['schedule on a non-publication workflow', ci.replace('  pull_request:', '  schedule:\n    - cron: "23 * * * *"'), /schedule|trigger/i],
  ['pull request target trigger', ci.replace('pull_request:', 'pull_request_target:'), /trigger/i],
  ['action without a version annotation', ci.replace(' # v7.0.1', ''), /version comment/i],
]) {
  test(`rejects ${name}`, () => assert.throws(() => validateWorkflow(source, 'ci.yml'), match));
}

for (const [name, source, match] of [
  ['missing map refresh', site.replace('      - run: node scripts/update-map.mjs\n', ''), /resolver/i],
  ['missing release resolver', site.replace('      - run: node scripts/update-brand.mjs\n', ''), /release|resolver/i],
  ['release resolution after installation', site.replace('      - run: node scripts/update-brand.mjs\n      - run: node scripts/update-map.mjs\n      - run: npm ci --ignore-scripts', '      - run: npm ci --ignore-scripts\n      - run: node scripts/update-brand.mjs\n      - run: node scripts/update-map.mjs'), /order|before/i],
  ['publication without checks', site.replace('      - run: npm run check\n', ''), /checks/i],
  ['ignoring failed release checks', site.replace('      - run: npm run check', '      - run: npm run check\n        continue-on-error: true'), /unconditional|failure|ignore/i],
  ['a second deployment step', site + '      - run: npm install --ignore-scripts\n', /only.*deploy-pages/i],
  ['extra deployment rights', site.replace('{pages: write, id-token: write}', '{pages: write, id-token: write, contents: read}'), /deploy.*permissions/i],
  ['deployment without the build dependency', site.replace('    needs: build\n', ''), /needs.*build/i],
  ['deployment from another branch', site.replace('branches: [main]', 'branches: [main, release]'), /main/i],
  ['manual publication without the main gate', site.replace("    if: github.ref == 'refs/heads/main'\n", ''), /main/i],
  ['publication without preparation gate', site.replace('bash scripts/build.sh --publish', 'bash scripts/build.sh'), /--publish/i],
  ['reusable workflow instead of a build', site.replace('    steps:', '    uses: other/repo/.github/workflows/build.yml@main\n    steps:'), /reusable|uses/i],
]) {
  test(`rejects ${name}`, () => assert.throws(() => validateWorkflow(
    source.replace(/(- run: node scripts\/update-(?:brand|map)\.mjs)/g, `$1${tokenEnv}`), 'site.yml'), match));
}
