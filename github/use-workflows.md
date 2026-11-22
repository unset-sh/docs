---
title: "Prepare a repository to use shared workflows"
description: "Configure a pinned caller while preserving repository checks and release requirements."
weight: 10
type: docs
params:
  doc_kind: guide
  checked_source_revision: "dc00d52ce2286c0559e68138c1d84ae2db2cc945"
---

A small workflow in your repository can call the shared implementation in `unset-sh/.github`. Your pull requests and pushes still trigger runs in your repository, and their check results appear there.

The implementation described here is **unreleased, at version 0.0.0**. Use this guide to prepare adoption. Do not install a caller with the placeholder below or substitute a moving branch such as `main`.

## Before you start

You need write access to the consuming repository, a `.nvmrc` naming its Node version, and a check command that runs from its root. GitHub Actions settings must allow the shared workflow. Before replacing an existing workflow, record its required check names, extra build steps, reports, and dependency-installation requirements.

The first shared check grants `contents: read` and accepts no stored secrets. Its optional install runs `npm ci --ignore-scripts`. A repository that needs authenticated package installation or dependency lifecycle scripts needs a reviewed workflow adaptation before switching.

## Configure the check caller

1. Select a reviewed release of `unset-sh/.github` and verify its commit using the [release reference](release-reference.md#verify-a-workflow-version). No first release is available in the implementation described here.
2. Start from the [check caller template](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/templates/check.yml). Put the caller in your repository's `.github/workflows/ci.yml`.
3. Replace `APPROVED_COMMIT_SHA` with that release's full 40-character commit. Set the branch and inputs for your repository. GitHub's picker substitutes `$default-branch`; replace it yourself if you copy the template as a file.

This illustrative caller checks pull requests and pushes to `main`. It assumes an npm lockfile and dependencies that can be installed without lifecycle scripts:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions: {}
jobs:
  check:
    uses: unset-sh/.github/.github/workflows/ci-check.yml@APPROVED_COMMIT_SHA
    permissions:
      contents: read
    with:
      install: true
```

The shared workflow checks out the consuming repository, takes Node from its `.nvmrc`, optionally installs dependencies, and runs its check command. The shared source supplies the job implementation; it does not replace your repository's tests.

## Check inputs

| Input | Default | Effect |
| --- | --- | --- |
| `install` | `false` | Run `npm ci --ignore-scripts` before checking. Leave false for a dependency-free repository. |
| `command` | `npm run check` | Command that must succeed, run from the repository root. |
| `keep` | Empty | Retain files at this path as the `check-output` artifact for 14 days, including after a check failure. Missing files produce a warning. |
| `timeout-minutes` | `10` | Maximum duration of the check job. |

## Verify the result

Open a pull request containing the caller change. Check that the run uses the intended central commit and that every previous required test or report still runs. With the caller job named `check` and the shared job named `Check`, the expected check label is `check / Check`; confirm the actual label before changing repository rulesets.

A failed check command must fail the run. If you set `keep`, inspect the retained report as well as the job status. The workflow adds no result outputs; consumers use its job conclusion and optional artifact.

## Recover from an adoption problem

If installation fails, compare the repository's previous installation policy with `npm ci --ignore-scripts`; do not hide the failure. If a required check remains pending, inspect the actual check name and the caller's event filters. Retain the existing checks until the replacement is verified.

An upgrade is a reviewed change to the pinned commit. Reverting that caller change restores the previous implementation, provided its input contract still matches. This does not undo anything already published by a release.

## Add releases separately

Prepare the owner-managed environment and repository settings in the [release reference](release-reference.md#prerequisites), then adapt the [release caller template](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/templates/release.yml). A successful check migration alone does not establish that publication or attestation verification works.

## Source and evidence

This guide was checked against [`ci/check.yml`](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/ci/check.yml), the caller templates, and the [workflow contract checks](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/checks/workflows.test.mjs). The example is a configuration template checked against that source, not an observed consumer run. GitHub documents [calling reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows) and their [caller context and permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).
