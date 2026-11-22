---
title: "GitHub organisation setup"
description: "Find organisation policies and learn how unset.sh maintains its shared GitHub automation."
weight: 40
type: docs
cascade:
  type: docs
menus:
  main:
    weight: 40
params:
  doc_kind: overview
  checked_source_revision: "0ad6db5b25ba484a1812b16bdbdbf5c266c0ee53"
---

The `unset-sh/.github` repository owns shared GitHub Actions, the organisation map, and community defaults. Its workflows provide a common check and a protected release process. Each consuming repository keeps its own event triggers, build commands, tests, and configuration.

The shared workflows are **unreleased, at version 0.0.0**. The release workflow publishes nothing at that version. These pages describe the implementation at `0ad6db5b25ba484a1812b16bdbdbf5c266c0ee53`; they do not claim that another repository has adopted it or that a production release has succeeded.

## Learn and use

- [Organisation defaults and reporting routes](organisation-defaults.md): find the policies and forms used across unset.sh repositories.

- [Prepare a repository to use the shared workflows](use-workflows.md): choose a reviewed version, configure a caller, and verify its result.
- [Export the public documentation](export-docs.md): produce a versioned section for review in the documentation repository.
- [Release reference](release-reference.md): check inputs, permissions, approval requirements, and recovery before enabling publication.

- [Manage a documentation publishing key](manage-docs-publishing-key.md): follow the owner-authorised setup, verification and retirement process.

## Understand and contribute

- [How organisation defaults work](organisation-defaults.md): understand inheritance, local overrides and verification.

- [How workflow sources become GitHub entry points](workflow-layout.md): follow a category file through generation and into a consuming repository.
- [Release reference](release-reference.md): understand the boundary between building an artifact and approving its publication.

## Source and publication

These pages are maintained in [`unset-sh/.github/docs/site/`](https://github.com/unset-sh/.github/tree/0ad6db5b25ba484a1812b16bdbdbf5c266c0ee53/docs/site). The documentation section mapping is `.github:docs/site/` to `unset-sh/docs:github/`: the visible section uses `github` because `.github` is a reserved framework directory.

The [export command and workflow](export-docs.md) produce a section from an exact commit, including its licence and source provenance. The workflow makes that export available as a downloadable artifact after checks; it does not write to the documentation repository. The organisation docs framework is live. This additional section remains pending its reviewed [import in docs PR #2](https://github.com/unset-sh/docs/pull/2), which records the section-name exception.

The [repository README](https://github.com/unset-sh/.github/blob/0ad6db5b25ba484a1812b16bdbdbf5c266c0ee53/README.md) also covers the organisation map. The [source licence](https://github.com/unset-sh/.github/blob/0ad6db5b25ba484a1812b16bdbdbf5c266c0ee53/LICENSE) is AGPL-3.0-only.
