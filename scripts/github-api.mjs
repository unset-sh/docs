// Metadata reads only; downloads and deployed provenance never use this credential.
// https://docs.github.com/en/actions/concepts/security/github_token
// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
const endpoints = [
  /^https:\/\/api\.github\.com\/repos\/unset-sh\/brand\/releases\?per_page=100&page=(?:[1-9][0-9]?|100)$/,
  /^https:\/\/api\.github\.com\/repos\/unset-sh\/brand\/git\/ref\/tags\/v0\.1\.(?:0|[1-9][0-9]*)$/,
  /^https:\/\/api\.github\.com\/repos\/unset-sh\/brand\/git\/tags\/[a-f0-9]{40}$/,
  /^https:\/\/api\.github\.com\/repos\/unset-sh\/\.github\/commits\/main$/,
];

function diagnostics(response, githubToken) {
  const fields = [];
  for (const name of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after']) {
    const value = response.headers.get(name);
    if (typeof value === 'string' && /^[0-9]{1,15}$/.test(value)
      && Number.isSafeInteger(Number(value)) && (!githubToken || !value.includes(githubToken))) {
      fields.push(`${name}=${Number(value)}`);
    }
  }
  const requestId = response.headers.get('x-github-request-id');
  if (typeof requestId === 'string' && requestId.length <= 128 && /^[A-Fa-f0-9]+(?::[A-Fa-f0-9]+)+$/.test(requestId)
    && (!githubToken || !requestId.includes(githubToken))) fields.push(`x-github-request-id=${requestId}`);
  return fields.length ? ` (${fields.join(', ')})` : '';
}

export async function fetchGitHubResponse(url, { fetchImpl = fetch, githubToken } = {}) {
  if (typeof url !== 'string' || !endpoints.some(pattern => pattern.test(url))) {
    throw new Error('Unapproved GitHub API endpoint');
  }
  if (githubToken !== undefined && githubToken !== ''
    && (typeof githubToken !== 'string' || githubToken.length > 8192 || !/^[\x21-\x7e]+$/.test(githubToken))) {
    throw new Error('Invalid GitHub API credential');
  }
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  let response;
  try {
    response = await fetchImpl(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  } catch {
    // Fetch errors may embed request details or a nested cause. Do not forward them.
    throw new Error('GitHub API request failed before a response was available');
  }
  if (response.status !== 200) {
    const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 'unknown';
    throw new Error(`GitHub HTTP ${status}${diagnostics(response, githubToken)}`);
  }
  return response;
}
