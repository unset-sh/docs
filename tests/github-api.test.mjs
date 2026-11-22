import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchGitHubResponse } from '../scripts/github-api.mjs';

test('refuses credential routing outside the fixed metadata endpoints before making a request', async () => {
  for (const url of [
    'https://api.github.com/repos/another/brand/releases?per_page=100&page=1',
    'https://api.github.com/repos/unset-sh/brand/releases?per_page=100&page=1&token=extra',
    'https://api.github.com/repos/unset-sh/brand/git/ref/tags/../../other',
    'https://raw.githubusercontent.com/unset-sh/.github/main/repos.json',
    'https://docs.unset.sh/_brand/provenance.json',
    'https://github.com/unset-sh/brand/archive/main.tar.gz',
    'https://api.github.com@outside.invalid/repos/unset-sh/.github/commits/main',
  ]) await assert.rejects(fetchGitHubResponse(url, {
    githubToken: 'fixture-token', fetchImpl: () => assert.fail('Disallowed URL reached the network'),
  }), /endpoint/i);
});

test('rejects malformed optional credentials without printing them or reaching the network', async () => {
  for (const githubToken of ['fixture-token\nInjected: value', {}, ' '.repeat(10)]) {
    await assert.rejects(fetchGitHubResponse('https://api.github.com/repos/unset-sh/.github/commits/main', {
      githubToken, fetchImpl: () => assert.fail('Invalid credential reached the network'),
    }), error => {
      assert.match(error.message, /credential/i);
      assert.doesNotMatch(error.stack, /fixture-token|Injected/);
      return true;
    });
  }
});

test('omits untrusted or oversized response metadata and refuses redirects without a fallback', async () => {
  let calls = 0;
  await assert.rejects(fetchGitHubResponse('https://api.github.com/repos/unset-sh/.github/commits/main', {
    githubToken: 'fixture-token', fetchImpl: async (url, options) => {
      calls++;
      assert.equal(options.redirect, 'error');
      return new Response('fixture-token body', { status: 302, headers: {
        location: 'https://outside.invalid/fixture-token', 'x-ratelimit-limit': '-1',
        'x-ratelimit-remaining': '1e3', 'x-ratelimit-reset': '9'.repeat(300),
        'retry-after': 'tomorrow', 'x-github-request-id': 'A'.repeat(200),
      } });
    },
  }), error => {
    assert.match(error.message, /HTTP 302/);
    assert.doesNotMatch(error.stack, /fixture-token|outside|tomorrow|AAAAAAAA|999999|1e3/);
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(calls, 1);
});
