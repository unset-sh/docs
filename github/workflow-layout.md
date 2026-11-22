---
title: "How workflow sources become GitHub entry points"
description: "Follow a category file through generation, review, and a consuming repository's run."
weight: 20
type: docs
params:
  doc_kind: explanation
  checked_source_revision: "dc00d52ce2286c0559e68138c1d84ae2db2cc945"
---

The repository separates where people edit workflows from where GitHub executes them. Category folders organise the authored YAML by purpose. A generator copies that YAML into the flat `.github/workflows/` directory required by GitHub.

This page describes the **unreleased implementation at `dc00d52ce2286c0559e68138c1d84ae2db2cc945`**. It explains the source and execution boundaries; it does not imply that every organisation repository already calls these workflows.

## One repository, two kinds of path

In `unset-sh/.github`, `.github` is the repository name. Inside it, `.github/workflows/` is a directory with a special meaning to GitHub Actions. Naming the repository `.github` does not replace the inner directory.

The category folders contain the files people maintain:

| Authored source | Generated entry point | Responsibility |
| --- | --- | --- |
| `ci/check.yml` | `.github/workflows/ci-check.yml` | Shared Node check |
| `ci/self.yml` | `.github/workflows/ci-self.yml` | This repository's check caller |
| `releases/package.yml` | `.github/workflows/releases-package.yml` | Protected package and release-asset publication |
| `releases/self.yml` | `.github/workflows/releases-self.yml` | This repository's release caller |
| `automation/org-map.yml` | `.github/workflows/automation-org-map.yml` | Map validation and scheduled drift notification |
| `automation/docs-export.yml` | `.github/workflows/automation-docs-export.yml` | Check and export public documentation as a downloadable artifact |
| `templates/check.yml` and its metadata | `workflow-templates/check.yml` and its metadata | Starter caller offered by GitHub's workflow picker |

The generator also recognises `pages/`, `deployments/`, and `code-scanning/`. Add a category's first real workflow when that responsibility moves here; an available category is not evidence that a deployment already exists.

## From source to a run

The arrows below mean “produces” for generation and “calls” for runtime:

```text
Authored source: ci/check.yml
    | npm run workflows produces
    v
Committed entry point: .github/workflows/ci-check.yml
    ^ a pinned caller calls
    |
Consumer repository: .github/workflows/ci.yml
    | its pull request or push starts
    v
Run checks against that consumer's code
```

The central repository owns job orchestration, helper scripts, and workflow tests. The consumer owns its triggers, input values, build/test commands, and required checks. A shared workflow runs with the consumer's GitHub context and the permissions its caller grants. Placing it centrally does not automatically trigger every repository.

## Example: change the shared check

Suppose the shared check needs a different artifact-retention setting. Edit `ci/check.yml` in a checkout of `unset-sh/.github`. With Node 26.12.0, run these commands from the repository root:

```sh
npm run workflows
npm run check
```

Commit the category source and generated entry point together. Generation adds a source comment and preserves the YAML body; it does not interpret or rewrite workflow expressions. A consumer still uses its existing pinned revision until a reviewed caller update selects the new one.

If someone edits the generated file directly, the freshness check reports the mismatch. Move the intended change into the category source and regenerate. The generator refuses symlinks, collisions with unmanaged files, and ambiguous template metadata rather than guessing which files it may overwrite or delete.

## Keep dependency pins current

The [Renovate configuration](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/.github/renovate.json) includes authored category YAML in `github-actions.managerFilePatterns` alongside the manager's default generated-workflow matching. This lets update proposals reach the source pins as well as their executable copies. Before accepting an update, regenerate from the category sources and run `npm run check`; a bot edit does not replace the generation-freshness gate.

## Why keep generated copies

The category structure makes the catalogue easier to maintain as it grows. GitHub requires the executable YAML in a flat directory, so this choice also creates committed copies. The [generator tests](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/scripts/workflows.test.mjs) and `npm run check` catch missing, stale, and orphaned generated output. Review still needs to assess the workflow's behaviour and permissions.

## Source and related guidance

The implementation is [`scripts/workflows.mjs`](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/scripts/workflows.mjs), with commands in [`package.json`](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/package.json). The relevant GitHub rules cover [reusable workflow locations](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows) and [organisation starter templates](https://docs.github.com/en/actions/how-tos/reuse-automations/create-workflow-templates).

To use these entry points, follow [Prepare a repository to use shared workflows](use-workflows.md). The [documentation export guide](export-docs.md) follows `automation/docs-export.yml` from a checked commit to an artifact. For the package and release-asset publication boundary, read the [release reference](release-reference.md).
