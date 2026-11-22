---
title: "Use the starter workflow templates"
description: "Install a small caller for unset.sh shared developer tooling and select its reviewed revision."
weight: 10
type: docs
params:
  doc_kind: guide
  checked_source_revision: "db0d794cf1761644ebc379fb2a36e50571f199a7"
---

The organisation's native [workflow templates](https://github.com/unset-sh/.github/tree/db0d794cf1761644ebc379fb2a36e50571f199a7/workflow-templates)
are maintained directly in `unset-sh/.github:workflow-templates/`. GitHub can offer them in a repository's Actions
workflow picker. They are starting files: each repository owns the caller it installs.

## Choose a reviewed tooling revision

The shared implementation lives in `unset-sh/tooling`, with executable files directly in `.github/workflows/`.
Its initial version is `0.0.0`, and no production release is claimed. For normal adoption, select the full commit SHA
of a reviewed tooling release. Follow the tooling [adoption guide](https://github.com/unset-sh/tooling/blob/0366edb2d04d5c24c19319770893b413d172567b/docs/site/use-workflows.md)
to verify the release, inputs and compatibility before installation.

The template's `APPROVED_COMMIT_SHA` is an intentional placeholder. Replace it before committing a caller. A reviewed
bootstrap may pin an exact implementation commit while the first release is pending; record that exception and its
scope in the consuming pull request. This repository's documentation caller uses that limited, read-only bootstrap.

## Install a caller

1. Choose the check or release template from the Actions picker, or copy its YAML into the consuming repository's
   `.github/workflows/` directory.
2. When copying a template manually, replace the literal `$default-branch` with the target default branch; the Actions
   picker performs that substitution itself. Replace the tooling revision placeholder with the reviewed full SHA. Confirm the workflow filename at that commit.
3. Set the repository's events, inputs and job permissions. Keep its build and test commands in the repository.
4. Open a pull request and run the appropriate source checks. Verify the workflow result in the consuming repository.

The check template delegates the common check contract to `ci-check.yml`. The release template delegates packaging
to `releases-package.yml`; publication still requires the tooling
[release gates](https://github.com/unset-sh/tooling/blob/0366edb2d04d5c24c19319770893b413d172567b/docs/site/release-reference.md)
and the owner's approved publishing configuration. Installing a file does not authorise a release or create credentials.

## Maintain the installed workflow

Templates are copied when installed. Editing the organisation template does not update existing callers. A dependency
updater can propose a new workflow reference, but required checks, eligible automatic merging and subsequent delivery
must each be configured explicitly. The initial tooling migration does not implement that adoption pipeline.

Review changes to events, permissions and inputs alongside the selected implementation revision. Keep any local
repository-specific workflow in its own repository and maintain substantive shared execution in `unset-sh/tooling`.
See GitHub's [workflow template documentation](https://docs.github.com/en/actions/how-tos/reuse-automations/create-workflow-templates)
and [reusable workflow documentation](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows).
