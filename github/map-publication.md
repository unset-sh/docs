---
title: "Prepare organisation map updates"
description: "Prepare and check generated map updates while preserving authored profile text, merged by a person."
weight: 25
type: docs
params:
  doc_kind: guide
  checked_source_revision: "7806769ceb152ebac554ae0b24d2fbb910f9a01d"
---

Edit `repos.json` when declared ownership, plans or explanations change. CI generates and validates the map
before accepting the change. Once that source reaches main, the shared publisher prepares a generated-only
PR into main for `MAP.md` and the marked navigation block in `profile/README.md`, then requests its required checks.
A person reviews and merges it, and the committed organisation profile changes with that merge. The banner, introduction, links and other authored README text are preserved.

## When updates run

The caller runs on relevant main changes, hourly at minute 41, and through **Run workflow** on main in
[map-publish](https://github.com/unset-sh/.github/actions/workflows/map-publish.yml). GitHub may delay scheduled
runs. A no-change run creates no branch or pull request. From this repository with its pinned Bun 1.4.4 installed,
local previews use:

```sh
bun run map
bun run check
```

`.github/maps.json` registers the renderer and its two fixed Markdown outputs. These committed GitHub views use
tooling's `automation-org-map.yml`. The website's live JSON maps use a separate default-branch timer and approved
main site build, which can collect from configured public sources without merging this generated Markdown PR.
Updating the committed GitHub profile still requires a person to merge its PR.

## Follow a generated update

1. Open the completed source run. Its read-only job checks out the exact source revision, regenerates the views,
   and runs the repository checks. It permits changes only to the two registered outputs.
2. Follow the PR into main created by the isolated publisher. The branch is `automation/map-<source-commit>`.
   The publisher preserves authored profile text and never executes consumer scripts with its write token.
3. Follow the three run links reported by the separate dispatcher. It receives only the PR number, head and base,
   verifies the actual bot-owned PR and complete tree again, and requests the existing workflows at that exact head.
4. Confirm `Check the organisation map`, `check / Check`, and `policy / Validate branch policy` succeeded for the
   expected head. Accepted dispatch alone does not prove successful checks. Review and merge the PR normally;
   merging stays a human action.

For example, a reviewed ownership change in `repos.json` can produce a new repository entry in both rendered views.
The generated PR has the source main commit as its only parent. The shared verifier checks its immutable base
and head, bot author, regular output files and unchanged authored profile text. Regeneration during the map check
must leave the committed views unchanged. This proves the PR contains the renderer's output, without inferring
whether the original ownership decision is correct.

## Run or troubleshoot checks

Generated check dispatches use three inputs: `pull-request`, `expected-head` and `expected-base`. All must match the
actual current PR; the head and base are full commit SHAs. The existing workflows execute on the generated branch,
while their central verifier reads real GitHub metadata before consumer commands run. No synthetic PR event or
passing status is created.

Any supplied identity input, or any dispatch on an `automation/map-` branch, activates verification. Blank or
partial generated inputs fail. The required check runs and fails on a failed proof: it is not hidden behind a
skipped condition. The documentation check selects a fixed failing command and installs no dependencies in that
case. The map check fails before checkout. A generated dispatch never reaches the writable drift-report job.
Ordinary PR and push checks retain their existing commands; ordinary manual drift and documentation-export runs
remain available without generated identity inputs. Documentation export runs after a successful check even when
the optional generated verifier was skipped; failed or cancelled checks never export.

A failed generation or validation leaves the published profile unchanged. Observed main changes stop publication
or dispatch; regenerate from the current base. Retrying reuses a branch and PR only when their complete tree, sole
source parent and head match the validated snapshot. It never overwrites a branch, adopts a modified PR or reopens
a closed one. Older queued runs may refuse.

If dispatch fails partway through, inspect existing runs before retrying because some may already exist. GitHub must
allow Actions to create PRs, and normal review and required checks still govern merging. Do not weaken protections
to silence a failed run. The publisher does not merge, promote production, approve withheld runs or change settings.

GitHub currently creates approval-required runs for some `GITHUB_TOKEN` PR events. The bounded dispatch route starts
checks directly after validating the real generated PR; it does not approve those withheld PR runs. See
[workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
and [skipped-job behaviour](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions).

## Scope and verification

The publisher does not rewrite `repos.json`, infer deployments, or approve new ownership decisions. The daily drift
report still identifies public repository metadata the curated source has not adopted. Workflow maps derive their
relationships directly from committed YAML.

Local tests evaluate the actual caller conditions for failed, cancelled, skipped and successful proofs, missing
inputs, ordinary PRs and manual drift. They also check required names, fixed pins, permissions and output freshness.
The central verifier and dispatcher have separate tests for immutable Git proof and returned run identities. First
live generated-PR dispatch remains a separate adoption check; local tests are not deployment evidence.

Alex maintains this guide with workflow changes and the repository's documentation review cycle. The
[tooling publication reference](https://docs.unset.sh/tooling/organisation-map-publication/) describes the central
job permissions, data bounds and source validation.

The caller wiring was checked against [the map publisher](https://github.com/unset-sh/.github/blob/7806769ceb152ebac554ae0b24d2fbb910f9a01d/.github/workflows/map-publish.yml), [map checks](https://github.com/unset-sh/.github/blob/7806769ceb152ebac554ae0b24d2fbb910f9a01d/.github/workflows/org-map.yml), [documentation checks](https://github.com/unset-sh/.github/blob/7806769ceb152ebac554ae0b24d2fbb910f9a01d/.github/workflows/docs-export.yml), and [condition tests](https://github.com/unset-sh/.github/blob/7806769ceb152ebac554ae0b24d2fbb910f9a01d/scripts/map-publication.test.mjs). The callers use the [reviewed central implementation](https://github.com/unset-sh/tooling/tree/7cd2e8c3d284cd9bb90c54f336adc0834b515d97).
