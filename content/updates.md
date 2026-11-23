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

Each change starts in the repository that owns it. Source repositories own their explanations and examples; `brand` owns the visual contract; `.github` owns the organisation map and community defaults; `tooling` owns shared automation; `agent-kit` owns the shared writing standard. The [organisation map](organisation.md) shows those boundaries.

The [publication guard](https://github.com/unset-sh/docs/blob/main/scripts/prepare.mjs) requires a real organisation source section and rejects the legacy app mirror. Framework explanations and preview fixtures do not count as source exports. Automatic delivery from a source needs configured publishing access. A read-only source artifact can instead be imported through a reviewed docs pull request.

## Write and publish a project page

{{< flow title="A documentation change from its owner to the reader" caption="Each source exports its own section; the docs repository builds and publishes the combined site." >}}
1. **Author in the source repository** — explain the project beside the code it describes.
2. **Review the source pull request** — check the explanation, examples, diagrams, and links.
3. **Export its section** — the source job replaces only its named folder in `docs`.
4. **Build the whole site** — the docs framework checks sources and renders navigation, search, and pages.
5. **Publish with Pages** — the separate deployment job publishes the checked artifact.
{{< /flow >}}

The export must preserve source ownership and licences. A job for `example-project` would replace only `example-project/`; it must not replace another section or the framework. [Profile-recipes PR #5](https://github.com/unset-sh/profile-recipes/pull/5) implements the first source-owned exporter and its checks. Its [first successful main-branch export](https://github.com/unset-sh/profile-recipes/actions/runs/45041327167) published only `profile-recipes/`, with its source revision and file hashes. A local preview alone does not prove that publishing access is configured. See the [source contract](https://github.com/unset-sh/docs/blob/main/.github/CONTRIBUTING.md#source-contract).

Framework pull requests run checks and both a real-source build and an explicit fixture preview. They cannot publish. Production preparation excludes fixtures and rejects the old `unset/` mirror. Only the separate Pages deployment job receives publication permissions. Sources: [PR validation](https://github.com/unset-sh/docs/blob/main/.github/workflows/ci.yml), [build wrapper](https://github.com/unset-sh/docs/blob/main/scripts/build.sh), and [Pages workflow](https://github.com/unset-sh/docs/blob/main/.github/workflows/site.yml).

## Take a compatible brand release

{{< flow title="A shared brand change reaching the documentation site" caption="The site workflow checks hourly, on main pushes, and on manual runs. Scheduled runs may be delayed by GitHub." >}}
1. **Publish a stable brand release** — `brand` owns its contract and release.
2. **Resolve a compatible 0.1.x version** — the docs updater selects a published stable release and resolves its tag to an immutable commit.
3. **Verify and build** — installation, package integrity, site checks, and publication guards must pass.
4. **Deploy the artifact** — readers receive the new assets with the built site.
{{< /flow >}}

Compatible patch releases can update the site without a docs source edit. The updater excludes draft releases, prereleases, older versions, and releases outside `0.1.x`. It checks deployed provenance to prevent a rollback or a changed tag for the same release. If there is no deployed provenance and no compatible published release, the checked-in immutable baseline remains available. A failed check stops publication. See the [release resolver](https://github.com/unset-sh/docs/blob/main/scripts/update-brand.mjs) and [hourly workflow](https://github.com/unset-sh/docs/blob/main/.github/workflows/site.yml).

The package’s CSS, fonts, mark, and icon data are copied with verified manifests and licences. Docs supplies layout and interaction. Changes outside the compatible release line require a reviewed consumer update. See the [brand adapter](https://github.com/unset-sh/docs/blob/main/scripts/brand.mjs).

### Which credentials are needed?

Brand publishes its own guide with GitHub Pages permissions and its package with the temporary `GITHUB_TOKEN` supplied to its release job. Neither workflow needs an SSH deploy key. Docs reads the public brand archive and organisation map without a stored credential, then publishes its own Pages artifact with GitHub-provided permissions. Sources: [brand Pages workflow](https://github.com/unset-sh/brand/blob/8c998a2990ae477daf5ac1636028f6cbf379577b/.github/workflows/pages.yml) and [brand release workflow](https://github.com/unset-sh/brand/blob/8c998a2990ae477daf5ac1636028f6cbf379577b/.github/workflows/release.yml).

For release and map revision lookups, docs uses its temporary read-only job token on fixed GitHub API endpoints. This avoids the shared anonymous API quota. Public files and archives do not receive the token, and npm does not inherit it. Failed lookups stop publication while the previous site stays available. See [GitHub's API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

A source job that pushes an export has a different boundary: it writes a named folder into another repository, `unset-sh/docs`. The source repository’s default token does not grant that cross-repository write access. Such a job needs separately configured access, currently a write deploy key. The exporter checks which paths it changes; the key itself grants repository access, not a restriction to one folder. The owner manages that key and the source’s protected `docs-mirror` environment. Preparing a read-only export artifact needs no deploy key. See [GitHub token permissions](https://docs.github.com/en/actions/concepts/security/github_token) and [deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

Follow the shared [publishing-key procedure in `tooling`](https://github.com/unset-sh/tooling/blob/838a965d14d0887291046c279422becb7b0228f3/docs/site/manage-docs-publishing-key.md) to create and connect a key, verify the first real export, rotate access, retire the previous publisher and remove local key copies. Source runbooks retain their repository-specific values and exporter checks. Removing a local key file, deleting a stored secret and revoking a destination deploy key are separate actions.

## Keep the organisation map current

The shared `tooling` map refresh workflow runs the generators registered in `.github/maps.json`. It validates every output before uploading one snapshot, and the docs build waits for that snapshot before checking and rendering the site. The organisation and workflow maps use this path. Future maps must register their generator and outputs, keep authoritative source facts upstream and expose their source revision and refresh time. See the [shared refresh guide](https://docs.unset.sh/tooling/map-refresh/).

The [workflow map](workflows.md) is a separate generated view of actual GitHub Actions configuration. On each production build, a reviewed collector from `tooling` discovers public organisation repositories, resolves their default branches to immutable revisions and reads flat `.github/workflows/` files. Reusable calls follow their exact referenced versions, including historical pins. Docs validates and renders that catalogue before publishing. Local previews use the committed snapshot; failed refreshes leave the previously deployed site in place. The hourly schedule is best effort, and the map displays its collection time.

This process discovers new public repositories without a hand-maintained list. It does not activate their workflows or releases. CI, release, deployment and documentation jobs remain owned and triggered by their repositories. The map shows declared configuration; runtime success, credentials and environment protection settings require separate verification.

{{< flow title="An ownership change reaching the organisation map" caption="The editable map stays in .github; this site renders a verified snapshot." >}}
1. **Update `.github/repos.json`** — review responsibilities, status, boundaries, and dependency qualifiers.
2. **Regenerate and merge upstream** — update `MAP.md` and the organisation profile from that source.
3. **Resolve main once** — the docs job reads `repos.json` at the resulting exact commit.
4. **Validate and render** — malformed maps, unknown references, duplicates, and dependency cycles stop the update.
{{< /flow >}}

The existing [.github map workflow](https://github.com/unset-sh/.github/blob/8b85cee1f3308e539f6f7ac331b7506da08c2ed7/.github/workflows/org-map.yml) checks generated pages on pull requests and compares the map with GitHub daily. Its drift check can flag repository metadata changes; humans still need to explain a changed responsibility in the map pull request.

The docs production workflow refreshes the map on each run, including its hourly schedule. It fetches only the fixed public `.github` source, records the commit and a SHA256 of the exact JSON bytes, and fails on fetch or validation errors. Local builds use the committed snapshot without a network update. The [map page](organisation.md) discloses whether that snapshot came from `main` or a proposed upstream pull request. Sources: [map updater](https://github.com/unset-sh/docs/blob/main/scripts/update-map.mjs), [snapshot provenance](https://github.com/unset-sh/docs/blob/main/data/org-map/source.json).

## Shared CI workflows: maintained in `tooling`

The agreed home for organisation CI checks, releases and reusable automation is [`unset-sh/tooling`](https://github.com/unset-sh/tooling). The organisation’s `.github` repository retains its metadata, community defaults and starter templates. The separate workflows repository has been retired. The initial tooling implementation is merged at version `0.0.0`; it has no approved release yet, and consumer adoption remains explicit.

CI already exists in individual repositories. Central tooling holds maintained workflow implementations and their helpers. `workflows/shared/` groups shared CI, docs and release automation; `workflows/<repository>/` groups centrally maintained automation specific to one repository. Flat executable entry points are generated into `.github/workflows/`. Workflows still native to a consumer remain visible in the map. Each consumer keeps its event triggers, small callers and project-specific build or check commands. Moving the shared check and release code does not change the existing callers in `brand`, `rendering`, or `agent-kit`. Each adoption needs a reviewed immutable pin. Automatic updating and merging require a separate implementation.

{{< flow title="A repository calling a shared check" caption="Each consuming repository owns its trigger and pins the tooling workflow to a reviewed commit. Adoption remains explicit." >}}
1. **Caller repository** — chooses when to check and which command to run.
2. **Pinned shared workflow** — checks out that caller and uses its `.nvmrc`.
3. **Repository command** — runs the requested check with read-only repository access.
4. **Result** — reports success or failure to the caller, with optional retained output.
{{< /flow >}}

The check interface can install dependencies with lifecycle scripts disabled before running the command. It does not choose a repository’s tests or documentation policy. Source: [`ci/check.yml`](https://github.com/unset-sh/tooling/blob/838a965d14d0887291046c279422becb7b0228f3/ci/check.yml), generated for callers as `.github/workflows/ci-check.yml`.

The release path verifies a main-branch push and version, runs the check and build once, then waits for owner approval before validating and publishing the release. The migration preserves those approval and verification gates. A failed prerequisite or check stops the path. Source: [`releases/package.yml`](https://github.com/unset-sh/tooling/blob/838a965d14d0887291046c279422becb7b0228f3/releases/package.yml), generated for callers as `.github/workflows/releases-package.yml`. Callers must adopt an approved immutable revision explicitly; existence in the organisation map does not establish adoption.

The reusable documentation exporter reads a caller’s committed `docs/site/` files and licence using the central helper at the workflow’s exact revision. It uploads a section artifact with provenance; it does not write into this repository or deploy Pages. Consumers run their own checks before calling it. Source: [`automation/docs-export.yml`](https://github.com/unset-sh/tooling/blob/838a965d14d0887291046c279422becb7b0228f3/automation/docs-export.yml). The source job remains confined to its section when an artifact is later imported.

Automatic brand adoption by docs starts after a brand release has been published. It does not approve or publish brand packages. The docs framework’s own publication workflow and local documentation-impact checker remain in this repository. Moving or packaging that checker in tooling and connecting shared CI are separate, reviewed integrations.

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

For example, changing the brand resolver requires reviewing this update flow or its operational guidance. Changing how the organisation map is interpreted requires reviewing the organisation page. New source areas use a fallback rule so they do not silently escape the check. See the [policy](https://github.com/unset-sh/docs/blob/main/.github/docs-impact.json), [checker](https://github.com/unset-sh/docs/blob/main/scripts/check-docs-impact.mjs), and [source-repository adoption guide](https://github.com/unset-sh/docs/blob/main/.github/DOCS-UPKEEP.md).
