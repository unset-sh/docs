# Organisation docs implementation plan

> For agentic workers: execute the bounded tasks below using the approved documentation design. Keep work on `codex/org-docs-root`; the initial preview-only scope has been extended by Alex's cutover authorisation. Follow the publication prerequisites and independent review before merging; compatible brand patch adoption may publish automatically after cutover.

**Goal:** Build and review the root Hugo site with shared brand assets and readable learning/architecture layouts, then complete the authorised site switchover when its source and retirement prerequisites pass.

**Architecture:** Source repositories own one exported section each. A guarded staging step assembles sections; Hugo/Hextra renders them using the unchanged generated CSS, fonts, icons, and mark from the brand package. The root framework owns navigation, accessibility, publication policy, and checks.

**Tech stack:** Hugo extended 0.168.0, Hextra 0.13.0, Node 26.12.0, GitHub Pages.

**Spec:** Alex's 2026-11-22 handoff, organisation decision org-0002, and the reviewed documentation standard in [agent-kit PR #7](https://github.com/unset-sh/agent-kit/pull/7).

## Constraints

- Organisation-only source sections. The cutover change removes legacy `unset/` on the review branch. Production preparation refuses any remaining legacy copy.
- Alex authorised the cutover on 2026-11-22 after preview review. At least one successful real organisation export and removal of the old app mirror remain prerequisites to the root merge and publication.
- Shared brand fonts and CSS are authoritative. The preview baseline is v0.1.1 at its immutable tag commit. Production may adopt stable 0.1.x releases automatically after checks, as Alex explicitly approved.
- Same-origin assets and scripts, no inline/eval, `font-src 'self'`, noindex/nofollow, no login or cookies.
- Only regular source files, no symbolic/hard links or section clashes.
- Workflow root permissions `{}`. Build reads contents; deploy only invokes deploy-pages with pages/id-token write. Actions and Hugo image pinned. No secrets or expressions in shell scripts.
- Framework AGPL-3.0-only; preserve source and asset licences. No AI attribution. No app documentation until it moves into the organisation.

## Review focus

- Changing the brand font file must update the site without a docs font edit.
- Empty source set, a malformed section, and source collisions must fail safely for publication.
- Deep relative links, fragments, code examples, and diagrams must render and resolve.
- Both themes, mobile navigation, search, and code-copy controls must work under the CSP.
- PR previews must never publish and legacy mirror pushes must not overwrite merged framework work before cutover.

## Tasks

### 1. Brand dependency and adapter

Files: `package.json`, `package-lock.json`, `.npmrc`, `scripts/brand.mjs`, `tests/brand.test.mjs`.

Consumes: the current verified schema-2 package contract. Produces: `.build/brand/static/_brand/` preserving package paths and `.build/brand/data/brand/{contract,resolved,meta,icons,iconMap}.json`.

- [x] Inspect the latest contract and release; pin an immutable source without adding a secret.
- [x] Add failing tests for any changed contract assumption, then adapt verification/copying only as needed.
- [x] Install reproducibly with lifecycle scripts disabled; test copied CSS/font bytes and all adapter rejection cases.

### 2. Hugo framework and reading layout

Files: `hugo.yaml`, `content/_index.md`, `layouts/`, `assets/css/custom.css`, `assets/js/brand-theme.js`, preview fixtures under `tests/fixtures/`.

Consumes: `.build/content` from `prepare.mjs`, brand output from task 1. Produces: self-contained `public/` output with section navigation, two reader entry points, search, local assets, and CSP.

- [x] Read the pinned theme's templates, then configure explicit mounts and class-based syntax highlighting.
- [x] Implement the homepage, theme dataset bridge, shared reading components, and local package icons.
- [x] Build an actual source-shaped fixture showing explanation, diagram, example, reference, and architecture boundaries. Keep it outside production content.
- [x] Check the real generated site in both themes and narrow layouts; verify search and code-copy behaviour.

### 3. Build, publication, and checks

Files: `.github/workflows/{ci,site}.yml`, `scripts/check-workflows.mjs`, `scripts/check-output.py`, associated tests and build wrappers.

Consumes: staged content and the root Hugo config. Produces: reproducible local/CI checks and a gated Pages artifact.

- [x] Add failing fixtures for unsafe workflow rights, unpinned actions, inline/remote output, and broken local destinations.
- [x] Implement checks; run the full tests, warning-failing Hugo build, output checks, and pinned actionlint.
- [x] Preserve publication prerequisites; deploy job contains only deploy-pages. PR builds have no publication rights.

### 4. Contributor contract and review

Files: `README.md`, `LICENSE`, `.github/CONTRIBUTING.md`, PR description.

Consumes: implemented commands, the approved design direction, and the handoff. Produces: concrete source export guidance and a reviewable framework PR.

- [x] Document only working commands; distinguish fixture preview from actual mirrored sources.
- [x] Explain shared brand updates, section metadata, writing patterns, local assets, source licences, and cutover order.
- [x] Fresh whole-branch review; fix material findings and rerun affected checks.
- [x] Prepare the branch for a draft framework PR with source/cutover dependencies explicit. The initial preview phase did not merge.

## Added scope agreed during implementation

- Automatic stable 0.1.x brand adoption through hourly production builds, immutable resolution, live-provenance rollback checks and unchanged least-privilege deployment. The initial preview phase did not publish; the subsequent cutover is now authorised.
- Organisation overview from the upstream map, retaining proposed/external distinctions and exact source revision. The map change stays in its owning repository, PR #5.
- Explanations for documentation, brand and kit workflows, with source references and current/planned boundaries.
- A reusable documentation-impact PR check and adoption guidance; shared freshness/workflow rules in agent-kit PR #7. Source repositories still adopt the check and kit explicitly.

The first real organisation export succeeded in [source run 45041327167](https://github.com/unset-sh/profile-recipes/actions/runs/45041327167), producing docs commit `743ebaccb944e766d9759102f409d3bcedd0ca91`. [App retirement PR #1987](https://github.com/Undefined6799/unset/pull/1987) merged as `9817f1e7ed51fdd5989d6bad6261a9e167d97b80`; no old mirror runs were queued or active. Alex explicitly delegated removal of the old access after verification: destination deploy key `170709714` and the old app environment `28129071275` were removed; the new source key and secret remain configured. Final source-integrated review and the framework deployment remain required. Follow [the cutover runbook](CUTOVER.md) and record each prerequisite before publication.

## Verification before the draft PR

Clean `npm ci --ignore-scripts`; 152 Node tests and 19 Python output tests; workflow guards; exact map snapshot validation; pinned actionlint; real-source and fixture Hugo builds with warnings fatal. Browser review covered light/dark themes, desktop/narrow layout, menu dismissal, search and code-copy feedback with no new console policy errors. Public brand output is checked byte-for-byte against the verified staged package, including provenance. Live resolver checks used temporary directories and changed no production state.
