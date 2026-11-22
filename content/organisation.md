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

**Status:** active means the repository exists, including any planned capabilities described in its entry. Pending means approved and awaiting setup; planned means agreed but not created; proposed means not approved; archived means archived on GitHub. The app appears only as external context; its documentation is not imported.

{{< organisation-map part="overview" >}}

## Repository boundaries

{{< organisation-map part="boundaries" >}}

## Dependency feeds

{{< organisation-map part="dependencies" >}}

## Keep ownership current

Change `repos.json` in `.github` when a repository’s responsibilities, status, dependencies, or boundaries change. Regenerate that repository’s `MAP.md` and profile, then review the changes together. Do not hand-edit this site’s snapshot. The existing [map workflow](https://github.com/unset-sh/.github/blob/8b85cee1f3308e539f6f7ac331b7506da08c2ed7/.github/workflows/org-map.yml) checks generated files on pull requests and checks GitHub repository drift daily; it cannot infer a changed responsibility from code.

The draft docs framework’s production workflow resolves `.github`’s `main` branch to one commit, validates the map, and builds from those exact bytes. Local previews use a committed snapshot and disclose its revision. Read [how updates reach the site](updates.md#keep-the-organisation-map-current).
