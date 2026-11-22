---
title: Understand the documentation boundaries
description: Content, visual identity, and rendering have different owners.
weight: 40
params:
  doc_kind: explanation
---

This example describes the documentation framework's proposed ownership. It is a preview for learning how to explain module boundaries, not a diagram of the app's implementation.

## Responsibilities

| Boundary | Owns | Does not own |
| --- | --- | --- |
| Source repository | Explanations, examples, reference, and their correctness | The site's CSS, menus, and deployment |
| Brand package | Shared visual tokens, fonts, mark, and icon data | Content meaning and page navigation |
| Docs framework | Assembly, rendering, navigation, and publication checks | Product rules and source documentation |

## A change through the system

The following arrows show the movement of documentation, not source-code imports.

{{< flow title="Documentation publishing flow" caption="Each source writes only its own section. The framework assembles sections into the site." >}}
1. **Source repository** — changes and checks a page.
2. **Exported section** — carries that repository's content and licence.
3. **Docs framework** — checks, builds, and presents the page.
{{< /flow >}}

The brand package supplies styles and assets to the framework independently of the content export. A font change belongs in the brand contract, not in each source page.

## What keeps the boundary clear

A source exporter must replace only its named destination section. The central build checks the assembled tree for links and section collisions. A source must not replace the website's root workflow or layouts.

These are the intended checks for this framework. Its [source repository](https://github.com/unset-sh/docs) contains the implementation under review; this fixture does not claim an unmerged change is deployed.

## Where a change belongs

Correct a misleading example in the repository that owns the page. Change reading layout in the docs framework. Change a shared font or colour role in the brand package, then update the site's pinned dependency and rebuild.
