# Keeping documentation aligned with the project

Source repositories own the meaning of their documentation. Update explanations, examples, code links, and diagrams in the same PR as the behaviour they describe. The docs framework then assembles those reviewed pages.

The docs-impact check makes that review visible. It checks changed paths against a repository-owned policy; it cannot decide whether a sentence, diagram, example, or exception reason is accurate.

## What the check requires

For each changed source file, the first matching rule in `.github/docs-impact.json` identifies relevant documentation. Every affected rule needs at least one matching documentation change. A fallback rule covers new areas so introducing a directory does not silently escape the check.

If no reader-facing explanation needs to change, put one unquoted line in the current PR body:

```text
Docs impact: no update needed — Internal function names changed; public behaviour and examples are unchanged.
```

The checker requires at least 20 characters and four words after the dash, rejects duplicate lines, and ignores examples inside fenced code, block quotes, or HTML comments. These are presence checks. The reviewer decides whether the reason is specific and true. Reconsider it whenever new commits change the PR's scope.

The reason is read only from the current `GITHUB_EVENT_PATH` pull-request payload. Saved reports, earlier PR files, and local command arguments cannot supply an exception. Editing the PR body should rerun the check through the `edited` event.

## Policy format

The policy has `schemaVersion: 1`, `exclude`, `documentation`, ordered `rules`, and `fallback`. A matcher is either an exact repository-relative file or a directory prefix ending in `/`:

```json
{
  "schemaVersion": 1,
  "exclude": [{ "prefix": "tests/" }],
  "documentation": [{ "prefix": "docs/" }, { "exact": "README.md" }],
  "rules": [{
    "id": "records",
    "source": [{ "prefix": "src/records/" }],
    "docs": [{ "exact": "docs/records.md" }]
  }],
  "fallback": {
    "id": "other-source",
    "docs": [{ "exact": "README.md" }]
  }
}
```

These paths illustrate a source repository; they are not paths in this framework. Prefixes respect directory boundaries: `src/records/` does not match `src/records-old/`. Put specific rules before broad ones. List all human documentation under `documentation`, including the destinations referenced by rules. Review policy changes alongside source changes; broad exclusions can conceal maintenance work.

This framework maps build commands and dependencies to the README, contributor guide, or workflow pages; rendering to the reading guidance; and publication to its operational instructions. Organisation-map logic maps specifically to `content/organisation.md`. Tests, vendored files, build outputs, and the two generated upstream map snapshots are excluded. Unknown source paths use the fallback.

## Run it locally and in CI

The checker uses Node built-ins and Git. It needs no npm installation, network access, token, or write permission.

In a pull-request job, with complete history fetched, run:

```sh
node scripts/check-docs-impact.mjs
```

For a local comparison, replace both revision placeholders with complete 40-character commit SHAs:

```sh
node scripts/check-docs-impact.mjs --base BASE_COMMIT_SHA --head HEAD_COMMIT_SHA --config .github/docs-impact.json
```

The comparison uses the merge base and PR head, as a PR diff does. Git runs with explicit arguments, NUL-delimited paths, and rename detection disabled; both the old and new paths of a rename remain visible. Deletions also count. Missing commits or malformed inputs fail the check. The local command has no prose-exception argument.

Use a `pull_request` job with `contents: read`, checkout credentials disabled, and `fetch-depth: 0`. Include `opened`, `synchronize`, `reopened`, and `edited` activity types so the body in each event matches the review being checked. Run the gate with the repository's other checks and require it for merging. Do not use `pull_request_target` or interpolate PR text into shell commands. The checker reads the event file directly.

## Adopt it in another source repository

Keep the editorial standard in agent-kit and the executable check in this docs repository. Do not add scripts to agent-kit.

Shared CI workflows and their helpers are moving into `unset-sh/.github` through [automation PR #6](https://github.com/unset-sh/.github/pull/6); the separate `workflows` repository is archived. The central implementation is still under review, not an adopted interface. This change enforces documentation impact locally in the docs framework. Shared workflow packaging and adoption in other repositories require their own reviewed integration and an immutable implementation revision.

For an explicitly reviewed interim adoption, choose a reviewed immutable docs commit when this framework lands, and record that commit in the adopting PR. There is no merged checker version to pin yet. Then use either approach:

1. Copy `scripts/check-docs-impact.mjs` from that exact commit, keeping its source commit recorded. Copy the policy structure and replace the rules with the source repository's actual code and documentation paths. Review later checker updates explicitly.
2. Check out `unset-sh/docs` at that exact commit into a separate tools directory using a checkout action pinned by full SHA. Run its checker from the source repository's working directory, passing the source-owned policy with `--config`. For example, a checkout at `.ci/docs-tools` can run `node .ci/docs-tools/scripts/check-docs-impact.mjs --config .github/docs-impact.json`. Keep both checkouts read-only with credentials disabled.

The source repository still owns its policy and review decisions. Add rules when it gains new interfaces, commands, data shapes, deployment steps, or architectural boundaries. Keep tests and generated-data exclusions narrow. This gate does not replace executable example tests, API compatibility checks, link checks, or the source's normal CI.

## Review the meaning, not only the changed files

When a rule is affected, follow the relevant explanation and its code links. Verify examples against the changed implementation, update relationships and boundaries in diagrams, and remove obsolete instructions. A changed page can still be wrong; a deleted page can still leave a gap.

For claims tied to implementation, record the source repository, full verified commit, and verification date near the reference or in the source page's metadata. Link to the actual code at that commit. When a behaviour changes, recheck those claims and advance the reference with the page. Avoid updating a verification date without performing that check.

For organisation changes, update the authoritative map upstream, including repository ownership and relationships. The generated `data/org-map/repos.json` and `data/org-map/source.json` snapshots are excluded from prose gating because they come from that upstream process. Their automatic refresh does not establish that the human explanation is current. Changes to the map's rendering or interpretation still require reviewing the organisation page.

Source exports carry reviewed documentation into this site. Edit the owning source, then export it; do not repair a mirrored explanation only in the docs repository. Reviewers remain responsible for semantic freshness even when every automated check is green.
