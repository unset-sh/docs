---
title: "Export the public documentation"
description: "Create a documentation section from an exact committed revision for a reviewed import."
weight: 15
type: docs
params:
  doc_kind: guide
  checked_source_revision: "dc00d52ce2286c0559e68138c1d84ae2db2cc945"
---

The documentation exporter packages the selected public pages from an exact Git commit. Use it to prepare a reviewed import into `unset-sh/docs`, or download the equivalent artifact from the documentation export workflow.

This guide describes the **unreleased implementation at `dc00d52ce2286c0559e68138c1d84ae2db2cc945`**. Creating an export does not publish it. Website publication remains pending the [docs framework cutover](https://github.com/unset-sh/docs/pull/1) and the source-mapping change described below.

## Before you start

Work from the root of a checkout of `unset-sh/.github`, with Git and Node 26.12.0 available. Select a reviewed commit whose implementation and documentation have been checked. It must already contain the pages under `docs/site/`; uncommitted edits are never copied into an export.

The output must be an absolute path to a directory that does not yet exist. Its parent directory must already exist. Choose a fresh destination for each export so the command cannot mix a new section with files from a previous one.

## Export a committed revision

1. Check the intended source revision in its checkout with `npm run check`. Commit documentation changes before selecting the revision that will contain them.
2. Obtain its full 40-character commit identifier with `git rev-parse HEAD`, or use the full identifier of another checked commit already available in the checkout.
3. Replace `FULL_40_SHA` below with that identifier and `/absolute/fresh-output` with your fresh output path. Run from the repository root:

```sh
npm run docs:export -- --revision FULL_40_SHA --out /absolute/fresh-output
```

The exporter reads the selected commit's `docs/site/` tree and licence through Git. It does not copy the working directory, the repository README, agent notes, or unrelated Markdown files. A dirty checkout therefore cannot add unpublished edits to an export of a clean commit.

## Inspect the result

The output keeps the public pages, licence, and provenance together:

```text
fresh-output/
└── github/
    ├── _index.md
    ├── use-workflows.md
    ├── other public pages
    ├── LICENSE
    └── source.json
```

`source.json` records provenance and per-file SHA-256 hashes. Confirm that its repository and revision match your selection and that `_index.md` and the intended public pages are present. The provenance identifies what was exported; it does not by itself prove that the documentation was reviewed or that its examples were executed.

If the command refuses an existing output directory, choose another fresh destination. If the selected commit predates the public pages, select a checked commit that contains them. If you expected a recent edit and it is missing, check whether it was committed and whether you selected that commit.

## Use the workflow artifact

The [documentation export workflow](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/automation/docs-export.yml) runs on pull requests, pushes to `main`, and manual dispatch. It runs the repository checks, exports the commit identified by `github.sha`, and uploads an artifact named `github-docs-<commit>` for 14 days. The downloaded artifact preserves the `github/` section folder. Inspect its recorded source revision before preparing an import.

The job uses a read-only repository token and no cross-repository write secret. It produces an artifact for review; it does not push to `unset-sh/docs` or deploy the website.

## Import through a documentation pull request

The publisher imports only the exported `github/` section through a pull request in `unset-sh/docs`. It must preserve provenance and the licence, and must not replace the docs framework, its `.github` directory, or another repository's section.

The source mapping is explicit: `unset-sh/.github:docs/site/` becomes `unset-sh/docs:github/`. The `github` slug avoids the framework's reserved `.github` directory. The framework can accept a `github` section, but its current contribution policy describes sections by exact source-repository name; the import pull request must record this exception. Keep publication pending until that policy alignment and the framework cutover are complete.

## Source and evidence

The command is declared in [`package.json`](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/package.json) and implemented by [`scripts/export-docs.mjs`](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/scripts/export-docs.mjs). The workflow source is [`automation/docs-export.yml`](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/automation/docs-export.yml). These instructions describe the committed-tree export contract. A successful local export or uploaded artifact is evidence of packaging only, not an observed website deployment.
