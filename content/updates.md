---
title: How updates reach the docs
description: Follow documentation, brand, map, and shared-standard changes from their owners to this site.
type: docs
weight: 20
menus:
  main:
    weight: 20
params:
  doc_kind: explanation
---

Each change starts in the repository that owns it. Source repositories own their explanations and examples; `brand` owns the visual contract; `.github` owns the organisation map; `agent-kit` owns the shared writing standard. The [organisation map](organisation.md) shows those boundaries.

**Framework status:** this page describes the organisation docs framework under review. It has not replaced the current app-fed site. Links to new framework code use the review branch; source export jobs still need to be configured. The [publication guard](https://github.com/unset-sh/docs/blob/codex/org-docs-root/scripts/prepare.mjs) refuses deployment while the legacy app mirror remains or no real organisation source section exists. These framework pages do not count as a source export.

## Write and publish a project page

{{< flow title="A documentation change from its owner to the reader" caption="Source export is a planned connection. The root build and Pages jobs are implemented in the draft framework." >}}
1. **Author in the source repository** — explain the project beside the code it describes.
2. **Review the source pull request** — check the explanation, examples, diagrams, and links.
3. **Export its section — planned** — the source job replaces only its named folder in `docs`.
4. **Build the whole site** — the docs framework checks sources and renders navigation, search, and pages.
5. **Publish with Pages** — the separate deployment job publishes the checked artifact.
{{< /flow >}}

The export must preserve source ownership and licences. A job for `example-project` would replace only `example-project/`; it must not replace another section or the framework. The source job is not implemented by this framework. Its setup, credentials, and first real export are cutover work. See the [source contract](https://github.com/unset-sh/docs/blob/codex/org-docs-root/.github/CONTRIBUTING.md#source-contract).

Framework pull requests run checks and both a real-source build and an explicit fixture preview. They cannot publish. Production preparation excludes fixtures and rejects the old `unset/` mirror. Only the separate Pages deployment job receives publication permissions. Sources: [PR validation](https://github.com/unset-sh/docs/blob/codex/org-docs-root/.github/workflows/ci.yml), [build wrapper](https://github.com/unset-sh/docs/blob/codex/org-docs-root/scripts/build.sh), and [Pages workflow](https://github.com/unset-sh/docs/blob/codex/org-docs-root/.github/workflows/site.yml).

## Take a compatible brand release

{{< flow title="A shared brand change reaching the documentation site" caption="The draft site workflow checks hourly, on main pushes, and on manual runs. Scheduled runs may be delayed by GitHub." >}}
1. **Publish a stable brand release** — `brand` owns its contract and release.
2. **Resolve a compatible 0.1.x version** — the docs updater selects a published stable release and resolves its tag to an immutable commit.
3. **Verify and build** — installation, package integrity, site checks, and publication guards must pass.
4. **Deploy the artifact** — readers receive the new assets with the built site.
{{< /flow >}}

Compatible patch releases can update the site without a docs source edit. The updater excludes draft releases, prereleases, older versions, and releases outside `0.1.x`. It checks deployed provenance to prevent a rollback or a changed tag for the same release. If there is no deployed provenance and no compatible published release, the checked-in immutable baseline remains available. A failed check stops publication. See the [release resolver](https://github.com/unset-sh/docs/blob/codex/org-docs-root/scripts/update-brand.mjs) and [hourly workflow](https://github.com/unset-sh/docs/blob/codex/org-docs-root/.github/workflows/site.yml).

The package’s CSS, fonts, mark, and icon data are copied with verified manifests and licences. Docs supplies layout and interaction. Changes outside the compatible release line require a reviewed consumer update. See the [brand adapter](https://github.com/unset-sh/docs/blob/codex/org-docs-root/scripts/brand.mjs).

## Keep the organisation map current

{{< flow title="An ownership change reaching the organisation map" caption="The editable map stays in .github; this site renders a verified snapshot." >}}
1. **Update `.github/repos.json`** — review responsibilities, status, boundaries, and dependency qualifiers.
2. **Regenerate and merge upstream** — update `MAP.md` and the organisation profile from that source.
3. **Resolve main once** — the docs job reads `repos.json` at the resulting exact commit.
4. **Validate and render** — malformed maps, unknown references, duplicates, and dependency cycles stop the update.
{{< /flow >}}

The existing [.github map workflow](https://github.com/unset-sh/.github/blob/8b85cee1f3308e539f6f7ac331b7506da08c2ed7/.github/workflows/org-map.yml) checks generated pages on pull requests and compares the map with GitHub daily. Its drift check can flag repository metadata changes; humans still need to explain a changed responsibility in the map pull request.

The draft docs production workflow refreshes the map on each run, including its hourly schedule. It fetches only the fixed public `.github` source, records the commit and a SHA256 of the exact JSON bytes, and fails on fetch or validation errors. Local builds use the committed snapshot without a network update. The [map page](organisation.md) discloses whether that snapshot came from `main` or a proposed upstream pull request. Sources: [map updater](https://github.com/unset-sh/docs/blob/codex/org-docs-root/scripts/update-map.mjs), [snapshot provenance](https://github.com/unset-sh/docs/blob/codex/org-docs-root/data/org-map/source.json).

## Shared CI workflows: proposed interfaces

`unset-sh/workflows` is the home for shared CI checks and release workflows. Its [current main revision](https://github.com/unset-sh/workflows/tree/687c9bcc9857965a6c39fc4fcf87c5e3cedfecb1) contains the repository README. [Workflows PR #1](https://github.com/unset-sh/workflows/pull/1) proposes the implementations below; they have not been verified as live, adopted workflows.

{{< flow title="A repository calling a shared check" caption="Proposed in workflows PR #1. Each consuming repository owns its trigger and pins the shared workflow to a reviewed commit." >}}
1. **Caller repository** — chooses when to check and which command to run.
2. **Pinned shared workflow** — checks out that caller and uses its `.nvmrc`.
3. **Repository command** — runs the requested check with read-only repository access.
4. **Result** — reports success or failure to the caller, with optional retained output.
{{< /flow >}}

The proposed check interface can install dependencies with lifecycle scripts disabled before running the command. It does not choose a repository’s tests or documentation policy. Source: [proposed `check.yml`](https://github.com/unset-sh/workflows/blob/4cdb60eab9d4e8d6f00ffc8521531b56a00a75b4/.github/workflows/check.yml).

The proposed release path verifies a main-branch push and version, runs the check and build once, then waits for owner approval before validating and publishing the release. A failed prerequisite or check stops that path. Source: [proposed `release.yml`](https://github.com/unset-sh/workflows/blob/4cdb60eab9d4e8d6f00ffc8521531b56a00a75b4/.github/workflows/release.yml). Callers must adopt an approved immutable revision explicitly; existence in the organisation map does not establish adoption.

Automatic brand adoption by docs starts after a brand release has been published. It does not approve or publish brand packages. The docs framework’s own publication workflow and its local documentation-impact check remain in this repository; shared CI integration is a separate, reviewed adoption.

## Adopt a shared documentation standard

{{< flow title="A writing-standard change reaching a repository" caption="The org-documentation standard is proposed in agent-kit PR #7. Adoption follows an approved release." >}}
1. **Change the standard in agent-kit** — review shared rules, architecture guidance, and templates together.
2. **Publish an approved kit release** — the kit packages its rules and records the release commit.
3. **Open a consumer update pull request** — the repository takes that release through `sync.mjs`.
4. **Check the installed copy** — the lock records the release, commit, and copied-file hashes.
{{< /flow >}}

The standard is proposed in [agent-kit PR #7](https://github.com/unset-sh/agent-kit/pull/7); this page does not imply it has shipped. The existing kit design uses release approval followed by a reviewed adoption pull request in each consuming repository. Its offline check detects edits to kit-owned copies. Change shared rules upstream and adopt a release; keep repository-specific facts in the repository’s own rules. Sources: [kit adoption and release design](https://github.com/unset-sh/agent-kit/blob/adf461d260972ea1c8c56b2e8ea4f169c108a009/README.md#how-a-repository-uses-it), [sync implementation](https://github.com/unset-sh/agent-kit/blob/adf461d260972ea1c8c56b2e8ea4f169c108a009/sync.mjs).

## Catch documentation drift during review

The framework’s PR check maps changed code, configuration, and workflows to relevant documentation. A change passes when the related page changes, or when the current PR body gives an explicit reason that no explanation needs to change. Reviewers assess that reason and the meaning of the edited pages; matching file paths cannot prove an example or diagram is correct.

For example, changing the brand resolver requires reviewing this update flow or its operational guidance. Changing how the organisation map is interpreted requires reviewing the organisation page. New source areas use a fallback rule so they do not silently escape the check. See the [policy](https://github.com/unset-sh/docs/blob/codex/org-docs-root/.github/docs-impact.json), [checker](https://github.com/unset-sh/docs/blob/codex/org-docs-root/scripts/check-docs-impact.mjs), and [source-repository adoption guide](https://github.com/unset-sh/docs/blob/codex/org-docs-root/.github/DOCS-UPKEEP.md).
