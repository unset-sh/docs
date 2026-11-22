---
title: "Export the organisation documentation"
description: "Package this repository's committed public pages through the shared tooling exporter."
weight: 15
type: docs
params:
  doc_kind: guide
  checked_source_revision: "9422ac99e93d1edd167912deae75f7eb0b9861ec"
---

Use the pinned documentation caller to prepare this repository's public pages for a reviewed import into `unset-sh/docs`.
The organisation website is live. [Docs PR #2](https://github.com/unset-sh/docs/pull/2) records the initial
`github/` section import. Verify each subsequent import and deployment separately from its export artifact.

## Download the workflow artifact

The [local caller](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/.github/workflows/docs-export.yml)
runs on pull requests, pushes to `main` and manual dispatch. It calls the common check first, then the reusable exporter
from an exact `unset-sh/tooling` commit. Both jobs have `contents: read` access and no cross-repository publishing secret.
The implementation is unreleased; this is a reviewed bootstrap pin while the first tooling release is pending.

After a successful run, download `docs-<commit>` within its 14-day retention period. The commit is `github.sha` for that
run; on a pull request it normally identifies GitHub's merge commit. Inspect `github/source.json` for the actual source
revision and file hashes. The artifact preserves the `github/` section folder, its pages, licence and provenance.

## Reproduce an export locally

Use Git and Node 26.12.0. Check out the reviewed tooling implementation and the intended `.github` source commit.
Run `npm run check` in each checkout. The source commit must contain `docs/site/` and `LICENSE`; uncommitted edits are
never included. Obtain its full SHA with `git rev-parse HEAD`.

Run the tooling exporter with absolute checkout paths and a fresh absolute output path whose parent exists:

```sh
node /absolute/tooling/scripts/export-docs.mjs \
  --root /absolute/github-source \
  --repository unset-sh/.github \
  --revision FULL_40_SHA \
  --out /absolute/fresh-output
```

The [shared exporter guide](https://github.com/unset-sh/tooling/blob/838a965d14d0887291046c279422becb7b0228f3/docs/site/export-docs.md)
defines the complete source and output contract. The result contains only the selected commit's public pages, its
licence and generated provenance:

```text
fresh-output/
└── github/
    ├── _index.md
    ├── organisation-defaults.md
    ├── other public pages
    ├── LICENSE
    └── source.json
```

Verify the source repository, revision and file hashes. If a committed page is absent, check the chosen revision.
If the destination already exists, select a fresh path; the exporter refuses to mix exports.

## Import through review

Import only `github/` into `unset-sh/docs`, preserving `source.json` and the licence. The mapping is deliberately
`unset-sh/.github:docs/site/` to `unset-sh/docs:github/`: `.github` is reserved for the framework's own automation.
Record that exception in the import pull request. Preserve the framework and every other source section.

Run the current docs framework checks and production build before merge. Inspect the deployed section separately
after publication. The source caller uploads an artifact; it neither pushes to the documentation repository nor
uses a publishing key. Credentialed publishing has its own owner-authorised [lifecycle guide](manage-docs-publishing-key.md).
