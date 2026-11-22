# unset.sh documentation

The framework for [docs.unset.sh](https://docs.unset.sh), built with Hugo and Hextra. It gathers selected human documentation from `unset-sh` repositories into one site.

Readers can learn to use a project or explore its concepts, code, and architecture. Each source repository owns its documentation. This repository owns assembly, navigation, rendering, and publication.

## Build and preview

Use Node **26.12.0** (`.nvmrc`), npm **11.20.0**, Python 3, and Docker. The build uses Hugo extended **0.168.0** pinned by image digest; Hextra **0.13.0** is pinned in `go.mod` and `go.sum`.

```sh
npm ci --ignore-scripts
npm run check
npm run build
```

The ordinary build uses only real source sections. Until the first export arrives, it produces the homepage and an empty project list. To review the formats with labelled sample content:

```sh
npm run preview:build
python3 -m http.server 8770 --bind 127.0.0.1 --directory public
```

Open <http://127.0.0.1:8770/>. Fixtures live in `tests/fixtures/preview`; they never enter a normal or publishing build. Every build clears stale destination files and checks local links, resources, page policy, and asset references.

`HUGO_BINARY` may point to a local Hugo 0.168.0 executable. `HUGO_BASEURL` overrides the canonical URL. Neither is needed for these commands.

## Source sections

Each source exports only its own `<repo>/` folder, with a section `_index.md`. Preparation discovers sections and stages them in `.build/content`; adding a valid source requires no mount-list edit. Framework folders and the legacy `unset/` folder are excluded.

Read [Contributing](.github/CONTRIBUTING.md) for the source contract, supported content, and checks. Edit source content in its owning repository, never in its mirrored folder here.

## Shared brand

The site consumes `@unset-sh/brand`'s generated CSS and bundled assets unchanged. Font selection and URLs live in that package; the site uses semantic font roles. The adapter verifies its manifest and copies assets and licences into the build.

The dependency is the **0.1.1 contract**, pinned to immutable commit `8c998a2990ae477daf5ac1636028f6cbf379577b` behind the `v0.1.1` tag and archive integrity in `package-lock.json`. This install consumes the public source archive. Registry publication and attestations are outside this install route.

The archive avoids package credentials in workflows and Git preparation installing the brand gallery's development dependencies. Lifecycle scripts are disabled. Changed archive bytes fail the lockfile integrity check; verify the source before updating the pin.

After cutover, the publishing workflow checks hourly for published stable `v0.1.x` GitHub releases, and resolves the highest compatible version to an exact commit. It updates the lock only inside that build, installs with lifecycle scripts disabled, checks the contract, tokens, icons and asset hashes, and builds and checks the site before publication. Other minor versions and prereleases require review. No docs style edit or merge is needed for a compatible brand update; Alex explicitly approved this exception for brand adoption.

The live `/_brand/provenance.json` records the installed version, source commit archive, integrity, asset hashes and framework commit. Subsequent runs compare it to the selected release and refuse a rollback, moved deployed tag or changed archive integrity. A 404 marker is treated as the first deployment; other retrieval errors fail the build. If checks fail, the current site remains live. This verifies source archive integrity, not registry attestations.

Local and pull-request builds use the checked-in baseline. To reproduce a deployed brand version locally, use the exact archive and integrity from its provenance. Production resolution can be run locally with `node scripts/update-brand.mjs`; this updates `package.json` and `package-lock.json` in the working copy. GitHub schedules can be delayed and public-repository schedules can be disabled after 60 days of inactivity; a manual site run uses the same checks. See [GitHub's schedule behaviour](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Keeping the documentation current

The organisation overview derives from `unset-sh/.github`'s `repos.json`, preserving ownership, status and dependency qualifiers. Each production build resolves that source to one exact commit and records its checksum. Local previews use a committed snapshot. Update the map upstream when repositories move or change responsibilities; refreshing a snapshot cannot repair stale source facts.

Pull requests run a documentation-impact check: changes to code, workflows or configuration must update the relevant documentation or include an explicit no-change reason for review. [Documentation upkeep](.github/DOCS-UPKEEP.md) explains the policy and adoption in source repositories. The shared standard and workflow explanation template are proposed in [agent-kit PR #7](https://github.com/unset-sh/agent-kit/pull/7); adoption remains explicit in each source repository.

## Publication and switchover

**Keep this framework change unmerged until the switchover is ready.** The app mirror currently owns root files on `main` and would overwrite them on its next run.

1. Merge the aligned organisation-map change and have a real organisation repository export documentation into its named section.
2. Remove the app mirror job before merging the root framework.
3. Remove legacy `unset/` from the framework branch, rerun checks, and have Alex merge.
4. The push to `main` builds and deploys the root site. Alex removes obsolete app credentials as agreed.

Publication refuses `unset/`, an empty source set, or a source set with no rendered section landing page. PR checks build the framework and fixtures without publication permissions. Only the separate deploy job can publish. No workflow here needs a secret.

The app stays off this site until it moves into `unset-sh`. Learning fixtures do not count as a real source export.

## Licence

Framework files: AGPL-3.0-only, in [LICENSE](LICENSE). Source sections keep their licences. Brand assets, copied Hextra partials, and the search bundle retain their upstream terms; see [third-party notices](.github/THIRD-PARTY-NOTICES.md).
