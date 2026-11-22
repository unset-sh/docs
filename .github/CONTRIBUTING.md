# Contributing to the documentation framework

The root framework belongs here. Project explanations, examples, diagrams, and reference belong in their owning repositories.

The shared human documentation standard is proposed in [agent-kit PR #7](https://github.com/unset-sh/agent-kit/pull/7). It supplies editorial rules, architecture guidance, and templates for **Learn and use** and **Understand and contribute**. Adopt it through an approved kit release; do not maintain competing copies.

## Source contract

A source job replaces only `<repo>/`, its exact organisation repository name. It must not replace root configuration, `.github`, assets, or another source's section. Preserve provenance and licences; never force-push an export.

The reserved-name exception is `unset-sh/.github`: its maintained human pages under `docs/site/` export to `github/`. The framework's `.github/` directory is never a source destination. An import must record this mapping, preserve the exact source revision and licences, and change only `github/`. Review any other alias explicitly before adding it. Preparing an artifact does not by itself configure automatic publication.

Each exported section starts with `_index.md`:

```yaml
---
title: Project name
description: What people can learn or do with this project.
type: docs
cascade:
  type: docs
menus:
  main:
    weight: 30
params:
  doc_kind: overview
---
```

Preparation requires a non-empty title, `type: docs`, `cascade.type: docs`, and integer `menus.main.weight`. Choose an intentional menu order; 30 is illustrative. Framework folder names are reserved. Symlinks, hardlinks, special files, and section collisions fail before staging changes.

Reading pages use `title`, `description`, `weight`, and `params.doc_kind`. Editorial kinds are `overview`, `tutorial`, `guide`, `explanation`, and `reference`. The homepage gathers tutorial/guide pages for the learning route and explanation pages for the understanding route. These fields drive presentation; their presence is not yet a universal source lint rule. Hugo's `type` remains `docs`.

## Content and diagrams

Use standard Markdown: headings starting at level two, paragraphs, lists, tables, language-labelled fenced code, and local images. Follow the shared writing standard for examples, sources, and architecture.

Use relative `.md` links within an export, canonical docs URLs for other sections, and absolute GitHub URLs for code outside it. The output check verifies local destinations and fragments. Do not use Hugo `aliases` until a CSP-compatible redirect is implemented; stock refresh output is rejected.

For images, use a leaf page bundle (`topic/index.md` with its image beside it). Provide useful alt text and nearby explanation, retain editable source and licences, and check both themes and narrow screens. No remote resources, raw HTML, per-page CSS, or scripts.

The `flow` shortcode renders a small static diagram as semantic HTML using shared tokens. It reflows vertically on narrow screens:

```markdown
{{< flow title="Documentation publishing flow" caption="Each source owns its exported section." >}}
1. **Source repository** — writes and checks its page.
2. **Exported section** — carries that repository's content.
3. **Docs framework** — builds and presents the page.
{{< /flow >}}
```

Use it for a simple ordered relationship, with adjacent explanation. Use a local rendered diagram for complex architecture and retain its editable source. Stock Mermaid is disabled. Do not weaken the CSP to enable it. New shared components must solve a repeated reading need.

## Visual ownership

`brand` owns tokens, fonts, mark, icons, and syntax colour. `docs` owns layout, navigation, accessible interaction, and rendering. Source repositories supply content, not themes.

The theme bridge maps Hextra's root class to the contract's `data-theme`. The icon partial maps theme names to pinned package drawings. Adapters must not invent missing visual values or icons.

## Keep explanations current

Follow [Documentation upkeep](DOCS-UPKEEP.md) for the documentation-impact check, ownership updates, source revisions and adoption in other repositories. Explain workflows using their real trigger, owning repository, inputs, boundaries, ordered steps, outputs, failure handling and recovery. Link the source workflow and scripts at the revision checked. Separate implemented behaviour from proposals.

The organisation view is generated from `.github`'s `repos.json`; edit that source and regenerate its map when ownership changes. Its latest committed facts are refreshed in production, while previews retain a pinned snapshot. Do not edit the copied map by hand or treat a refresh as a substitute for maintaining the original.

The dependency diagram above its source citation is laid out at build time from the same validated map. Right-angle arrows run from dependency to consumer, with separate attachment points and lanes; disconnected repositories remain visible. Node links work without JavaScript, while pointer and keyboard focus highlight direct connections. Narrow reading areas show a compact dependency view from the same data, without sideways scrolling. Keep the source's status and relationship conditions: an active repository does not prove an integration is running. When changing the diagram, verify arrow direction, keyboard links, both themes and narrow reflow. Do not hand-maintain positions or dependency arrows.

## Verify a change

Run `npm run check`, `npm run build`, and `npm run preview:build` after a clean `npm ci --ignore-scripts`. The preview exercises explanation, diagrams, code, reference, and boundaries without publishing fixtures.

Checks cover staging, manifest integrity, workflow permissions, and rendered output. CI also runs pinned actionlint and both Hugo builds with `--panicOnWarning`. Example correctness still needs verification in the owning source repository.

For rendering changes, check both themes, narrow reflow, keyboard use, focus, search, code copying, and the browser console. Automated output checks are not a claim of full accessibility or runtime correctness. Target WCAG 2.2 AA in the composed pages.

Keep the same-origin policy including fonts, noindex/nofollow, and absence of cookies, login, analytics, and third-party widgets. Keep deploy permissions isolated from build. Alex manages keys, settings, switchover, and merging.

## Pinned implementation references

- [Hugo mounts](https://gohugo.io/configuration/module/) and [build command](https://gohugo.io/commands/hugo_build/), verified with 0.168.0.
- [SVG links](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/a) and [arrow markers](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/marker), used by the static organisation diagram; styling and progressive interaction stay in external assets.
- [CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries), used to adapt the map to the reading area's width.
- [Hextra 0.13.0 layouts](https://github.com/imfing/hextra/tree/v0.13.0/layouts) and [theme initialization](https://github.com/imfing/hextra/blob/v0.13.0/assets/js/head/theme.js).
- [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
