---
title: Organisation map
description: Find the repository that owns a responsibility and see how the projects depend on each other.
type: docs
weight: 10
menus:
  main:
    weight: 10
params:
  doc_kind: overview
---

The diagram shows how repositories feed one another; the cards group them by responsibility. Follow a repository to see what it owns and where related work belongs. Both views come from `.github/repos.json` at the source revision shown below.

On narrow pages, the diagram becomes a compact set of cards showing what each repository receives from.

Use **On this page** to jump to a repository, or [All documentation](all-docs.md) to browse published guides and references. [Start here](start-here.md) introduces AT Protocol and the Matrix chat design.

The [workflow map](workflows.md) shows events, reusable workflow calls and job dependencies collected from the actual workflow files. It complements the ownership relationships on this page.

**Status:** active means the repository exists, including any planned capabilities described in its entry. Pending means approved and awaiting setup; planned means agreed but not created; proposed means not approved; archived means archived on GitHub. The app appears only as external context; its documentation is not imported.

{{< organisation-map part="overview" >}}

## Repository boundaries

{{< organisation-map part="boundaries" >}}

## Dependency feeds

{{< organisation-map part="dependencies" >}}

## Keep ownership current

Change `repos.json` in `.github` when a repository’s responsibilities, status, dependencies, or boundaries change. Regenerate that repository’s `MAP.md` and profile, then review the changes together. Do not hand-edit this site’s snapshot. The existing [map workflow](https://github.com/unset-sh/.github/blob/8b85cee1f3308e539f6f7ac331b7506da08c2ed7/.github/workflows/org-map.yml) checks generated files on pull requests and checks GitHub repository drift daily; it cannot infer a changed responsibility from code.

The map distinguishes agreed ownership, implemented workflows and adoption by consuming repositories. Keep pending qualifications until each implementation and connection is verified. Repository existence alone does not make a connection live.

The production workflow calls the shared map refresh in `tooling`. This map is registered alongside the workflow map in `.github/maps.json`. Its generator resolves `.github`’s `main` branch to one commit, validates the map, and records those exact bytes. The shared job passes all maps to the build only after every generator succeeds. The revision lookup uses GitHub’s temporary read-only job token; the map file itself is fetched publicly at that exact revision. A failed lookup keeps the previously published map available. Local previews use a committed snapshot and disclose its revision. The source caption shows the last successful collection time; older snapshots without a timestamp say so explicitly. Read [how updates reach the site](updates.md#keep-the-organisation-map-current).
