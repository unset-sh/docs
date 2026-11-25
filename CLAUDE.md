# CLAUDE.md: unset-sh/docs

## Where this repository fits

This is `unset-sh/docs`: the framework for the docs.unset.sh documentation website (Hugo and Hextra), which gathers
selected human documentation from `unset-sh` repositories into one site.

- **Belongs here:** the root Hugo configuration, layouts, navigation, front page and publication framework; the
  organisation map and workflow views derived from `unset-sh/.github` at an exact revision; one top folder per
  participating repository, replaced only by that repository's export; the site's build, checks and GitHub Pages
  publication.
- **Does not belong here:** the content of a mirrored section (that is its source repository's `docs/`, for
  example `unset-sh/profile-recipes`); repository ownership descriptions (that is `repos.json` in
  `unset-sh/.github`); shared visual values and assets (that is `unset-sh/brand`); shared workflow and export
  implementations (that is `unset-sh/tooling`); AI working material (that is `unset-sh/agent-kit` under `notes/`
  and `artifacts/`).
- **Uses:** `unset-sh/brand` for the site's CSS and assets at an exact commit; `unset-sh/.github` for the map;
  `unset-sh/tooling` for documentation import, map refresh and branch policy at full commits; `unset-sh/agent-kit`
  as the copy under `.claude/`. **Used by:** readers of docs.unset.sh, and every repository that exports its docs.
- **Licence:** follows the organisation rule. Hextra and other vendored work keep their own licences
  (`.github/HEXTRA-LICENSE.txt`, `.github/THIRD-PARTY-NOTICES.md`); each mirrored section keeps its source's.

The map of every unset.sh repository is <https://github.com/unset-sh/.github/blob/main/MAP.md>. Read it before
moving work between repositories or starting work that might belong elsewhere.

**Keep the map current.** When a change here adds, removes or moves a responsibility, changes what this
repository uses or ships, or renames or archives it, open a pull request on `unset-sh/.github` that updates
`repos.json` (run `npm run map` there) and update this section to match.

## Rules

- Never hand-edit a mirrored section (`profile-recipes/`, `tooling/`, `github/` and any later `<repo>/`). Fix the
  source and export again. A source export replaces only its own folder, and `.github/` is never a destination.
- Read [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for the source contract and
  [`.github/DOCS-UPKEEP.md`](.github/DOCS-UPKEEP.md) for the docs-impact check before changing the framework.
- Publication and import workflows are security-sensitive. Keep their tokens job-scoped and their pins exact;
  `scripts/check-workflows.mjs` enforces the invariants. Never add a stored publishing credential here.
- A local or preview build is not proof that a source publishes: verify the live run before saying it works.

## Commands

```sh
npm ci --ignore-scripts
npm run check   # tests, output checks, workflow checks, map freshness, and the agent-kit copy check
npm run build   # needs Docker for the pinned Hugo image
```
