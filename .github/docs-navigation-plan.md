# Documentation Navigation Implementation Plan

> **For agentic workers:** implement the approved tasks with bounded ownership, then independent review of the complete change. Track verification below.

**Goal:** Make published documentation discoverable and introduce AT Protocol and the Matrix chat design with authoritative sources.

**Architecture:** Hugo builds the index and navigation from staged Page objects and existing doc_kind metadata. Shared partials group pages by purpose. Native disclosures provide page navigation on narrow screens; no new runtime dependency is needed.

**Tech Stack:** Hugo extended 0.168.0, Hextra 0.13.0, Node 26.12.0, existing brand 0.1.1 contract.

**Spec:** [Approved design](docs-navigation-design.md).

## Global constraints

Preserve source-owned exports, current URLs, brand tokens/fonts, same-origin CSP, noindex and publication gates. No empty navigation groups or unpublished app content. Working notes stay in .github because a root docs/ folder would be interpreted as another source export.

## Review focus

- New or nested source pages appear without a manual framework edit; unknown doc_kind values remain discoverable.
- Navigation never links to a draft, expired or non-HTML page; index links remain valid with source sections absent in a local fixture.
- Project overviews remain reachable and active pages have a clear location.
- Narrow layouts, keyboard focus, expanded menus and TOC disclosures remain usable without overflow or duplicated active-page headings in the site menu.
- AT Protocol explanation distinguishes protocol roles from unset-specific implemented behaviour and links primary sources beside the relevant explanation.

## Task 1: Complete index and compact homepage

Files: content/all-docs.md; layouts/_shortcodes/documentation-index.html; layouts/_partials/docs/page-groups.html; layouts/_partials/docs/page-list.html; layouts/home.html; assets/css/custom.css; scripts/check-navigation.py; tests/check-navigation-fixtures.py; scripts/build.sh; README.md; .github/CONTRIBUTING.md.

Interfaces: page-groups takes a Pages collection and returns ordered dictionaries with title and pages: Overview (overview), Learn and use (tutorial/guide), Understand and contribute (explanation), Reference (reference), Other documentation (remaining kinds). All documentation links to every renderable document other than itself/home; published section overviews are included. Homepage search reuses the pinned theme's existing search trigger without duplicating its dialog.

- [x] Write a rendered-output check that fails on the current site: missing All documentation/start-here links, missing generated index, and absent project Overview.
- [x] Implement grouped index, compact homepage, and visible entry points; use known metadata instead of hard-coded project names.
- [x] Build production and fixture previews; assert index covers HTML documents, nested/reference fixture pages and map anchors.
- [x] Document generated discovery and contributor metadata.

## Task 2: Consistent project navigation and page contents

Files: layouts/_partials/sidebar.html; layouts/_partials/toc.html; layouts/_partials/custom/content-begin.html; layouts/_partials/docs/local-contents.html; assets/css/navigation.css. Root integrates its fingerprinted stylesheet into custom/head-end.html.

Interfaces: reuse docs/page-groups.html from Task 1; project Overview links to FirstSection.RelPermalink. local-contents takes the Page, renders normal heading anchors and map repository anchors when the page uses organisation-map. Native details/summary provides narrow contents independently of the site menu. Existing Hextra mobile menu classes/behaviour remain compatible.

- [x] Confirm current generated output fails checks for global index, Overview and independent mobile contents.
- [x] Implement grouped project sidebar, global return links, native mobile contents and data-derived repository jumps; keep no-empty-groups behaviour.
- [x] Check real/fixture generated links and keyboard/mobile browser behaviour.

## Task 3: Protocol orientation

Files: content/start-here.md. Add only framework-level orientation, approximately 400 words including the documentation entry points and the subsequently requested Matrix chat context.

- [x] Read official AT Protocol and Matrix guides/specifications and the pinned chat domain decision; link precise sources beside claims.
- [x] Write plain-language introduction with a small concrete example and links to existing organisation/project docs.
- [x] Review accuracy, scope and links; validate with the site build. Prose needs editorial review, not a mirrored text test.

## Final verification and delivery

- [x] Clean dependency install, full npm check, real-source build, preview build and publication build; pinned actionlint and documentation-impact check.
- [x] Browser: both themes; narrow and desktop navigation; index discovery; native contents and repository jumps; search; no new console/CSP errors.
- [x] Independent whole-change review; resolve material findings.
- [ ] Open PR with verified results. Publish through the existing authorised deployment workflow after checks, then verify live pages and source citations.


## Verification record — 2026-11-22

- Before implementation, the rendered navigation check failed because All documentation was absent.
- Clean dependency install; 176 Node tests and 19 Python tests passed. Workflow checks and pinned actionlint passed.
- Real-source build: 11 HTML pages checked, 8 indexed documents. Preview build: 18 HTML pages checked, 15 indexed documents, including nested/unclassified content and skipped heading levels.
- The pinned production Docker build passed with publication guards and no fixture pages.
- Independent review found and verified fixes for link-only Hugo pages and a source-specific link in framework orientation. A source-free build passed with 6 HTML pages and 3 indexed documents.
- Browser checks at 1280px and 567px verified both themes, index links, Overview state, collapsed/expanded site trees, native page contents, map repository jumps, keyboard navigation and homepage search. No warning/error console entries were observed. Collapsed-tree overflow found during the visual check was fixed and rechecked.
- Source exports, workflow permissions, brand pins and the same-origin policy are unchanged. Publication and live verification are recorded in the pull request after checks.
