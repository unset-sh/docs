# Third-party notices

- Hextra 0.13.0: MIT, copyright (c) 2023 Xin. The pinned Hugo module supplies the theme. `layouts/_partials/theme-toggle.html` and `navbar-link.html` remove inline positioning attributes. `layouts/_partials/sidebar.html`, `toc.html`, `assets/js/core/code-copy.js`, and `assets/js/search-dialog.js` preserve the pinned theme behaviour while consuming verified brand icon drawings; the search override also replaces an inline shortcut-key font size with a CSS class. The full notice is in [HEXTRA-LICENSE.txt](HEXTRA-LICENSE.txt).
- FlexSearch: the vendored search asset, licence, and copied-bundle SHA256 are in [`assets/js/vendor/`](../assets/js/vendor/).
- `@unset-sh/brand`: CSS and assets are copied unchanged at build time with their manifest, licences, and third-party notices. Fonts, mark, and icon data retain their respective package terms. These files are served under `/_brand/`.
- YAML 2.9.1: ISC, used by build checks. Its licence is included in the installed package. It is not a browser runtime dependency.
