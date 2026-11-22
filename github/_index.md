---
title: "Organisation workflows"
description: "Use shared GitHub Actions and understand how unset.sh maintains them."
weight: 40
type: docs
cascade:
  type: docs
menus:
  main:
    weight: 40
params:
  doc_kind: overview
  checked_source_revision: "dc00d52ce2286c0559e68138c1d84ae2db2cc945"
---

The `unset-sh/.github` repository owns shared GitHub Actions, the organisation map, and community defaults. Its workflows provide a common check and a protected release process. Each consuming repository keeps its own event triggers, build commands, tests, and configuration.

The shared workflows are **unreleased, at version 0.0.0**. The release workflow publishes nothing at that version. These pages describe the implementation at `dc00d52ce2286c0559e68138c1d84ae2db2cc945`; they do not claim that another repository has adopted it or that a production release has succeeded.

## Learn and use

- [Prepare a repository to use the shared workflows](use-workflows.md): choose a reviewed version, configure a caller, and verify its result.
- [Export the public documentation](export-docs.md): produce a versioned section for review in the documentation repository.
- [Release reference](release-reference.md): check inputs, permissions, approval requirements, and recovery before enabling publication.

## Understand and contribute

- [How workflow sources become GitHub entry points](workflow-layout.md): follow a category file through generation and into a consuming repository.
- [Release reference](release-reference.md): understand the boundary between building an artifact and approving its publication.

## Source and publication

These pages are maintained in [`unset-sh/.github/docs/site/`](https://github.com/unset-sh/.github/tree/dc00d52ce2286c0559e68138c1d84ae2db2cc945/docs/site). The documentation section mapping is `.github:docs/site/` to `unset-sh/docs:github/`: the visible section uses `github` because `.github` is a reserved framework directory.

The [export command and workflow](export-docs.md) produce a section from an exact commit, including its licence and source provenance. The workflow makes that export available as a downloadable artifact after checks; it does not write to the documentation repository. Publication remains pending the [docs framework cutover](https://github.com/unset-sh/docs/pull/1) and a reviewed import that records the section-name exception.

The [repository README](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/README.md) also covers the organisation map. The [source licence](https://github.com/unset-sh/.github/blob/dc00d52ce2286c0559e68138c1d84ae2db2cc945/LICENSE) is AGPL-3.0-only.
