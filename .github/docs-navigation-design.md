# Documentation navigation and introduction

Approved in the 2026-11-22 conversation: make a complete generated index, consistent project navigation, an independent mobile table of contents, repository jumps on the map, and a compact homepage with search and both reader routes. Add short AT Protocol and Matrix chat introductions with appropriate primary-source links.

The existing site has eight content pages, audience links capped at four on the homepage, and different navigation for root and project pages. Narrow screens combine page headings and the site tree in one menu. Readers need to discover what exists and retain their place.

## Approach

A generated index plus consistent navigation fits the approved request. A standalone list alone would leave the mobile and project-navigation problems; a wholesale content/URL reorganisation is unnecessary for this change.

- `/all-docs/` lists available root guides and project sections, with descriptions and purpose groups. Include nested content, section overviews and unclassified pages; omit empty groups and non-rendered pages. Source metadata drives discovery.
- Every page offers All documentation. Project navigation includes Overview and populated Learn and use, Understand and contribute, Reference, and Other documentation groups.
- On smaller screens, a separate native On this page disclosure sits near the page title. The organisation page also exposes repository anchors derived from the same map data, including desktop contents navigation.
- Homepage introductions are compact. Start here and Browse all docs are prominent, search is directly available, and both audience paths remain.
- `/start-here/` explains the docs and briefly introduces AT Protocol: stable account identifiers, readable handles, records and Lexicons, PDS hosting and application interpretation. Official guides/specifications support the explanation. A short Matrix section explains the chosen chat boundary, rooms, events and homeservers, with official and pinned project references. Distinguish design from deployed functionality; make no unsupported claims about unset's unpublished application implementation.

## Boundaries

Brand remains authoritative for typography, colour and assets. Existing URLs, source-owned exports and licences remain intact. Preserve same-origin assets, CSP, noindex, keyboard navigation, search, breadcrumbs and previous/next links. Only published organisation docs appear; the external app remains map context. Do not create empty architecture/reference categories.
