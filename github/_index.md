---
title: "GitHub organisation setup"
description: "Find unset.sh community defaults, repository navigation and starter workflow templates."
weight: 40
type: docs
cascade:
  type: docs
menus:
  main:
    weight: 40
params:
  doc_kind: overview
  checked_source_revision: "9422ac99e93d1edd167912deae75f7eb0b9861ec"
---

`unset-sh/.github` owns the organisation profile, repository map, community defaults and starter workflow templates.
Shared CI, release and documentation-export implementations live in `unset-sh/tooling`. Each consuming repository
chooses its events, permissions, inputs and reviewed workflow revision.

## Learn and use

- [How organisation defaults work](organisation-defaults.md): find policies, reporting routes and inherited forms.
- [Use the starter workflow templates](workflow-templates.md): install a small caller in a consuming repository.
- [Export the organisation documentation](export-docs.md): prepare this section for a reviewed documentation import.
- [Automatic map publication](map-publication.md): follow source changes, generated updates and recovery.

## Understand and contribute

- [How organisation defaults work](organisation-defaults.md): understand inheritance, overrides and maintenance.
- [Repository map maintenance](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/README.md): edit its source and regenerate the navigation.
- [Repository instructions](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/CLAUDE.md): preserve ownership and review boundaries.

## Find shared developer tooling

The [tooling guide](https://github.com/unset-sh/tooling/tree/838a965d14d0887291046c279422becb7b0228f3/docs/site) covers reusable workflow
inputs, source layout, release approval and documentation export. The initial implementation remains unreleased at
version `0.0.0`. A repository's adoption is a separate reviewed change; creating a template or moving its implementation
does not establish automatic updates, merging or delivery.

## Source and publication

These pages are maintained in [this repository's docs/site directory](https://github.com/unset-sh/.github/tree/9422ac99e93d1edd167912deae75f7eb0b9861ec/docs/site).
The mapping is `unset-sh/.github:docs/site/` to `unset-sh/docs:github/`, avoiding the documentation framework's reserved
`.github` directory. The pinned [export caller](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/.github/workflows/docs-export.yml)
produces a read-only artifact after checks, with its source revision, licence and file hashes. It does not publish it.

The organisation documentation website is live. [Docs PR #2](https://github.com/unset-sh/docs/pull/2) records
the initial import of this section; later updates follow the same source-owned export and review process. The
[repository README](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/README.md) also documents the repository map.
The [source licence](https://github.com/unset-sh/.github/blob/9422ac99e93d1edd167912deae75f7eb0b9861ec/LICENSE) is AGPL-3.0-only.
