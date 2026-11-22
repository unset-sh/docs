// Hextra 0.13.0 uses root classes; the brand contract uses data-theme.
// https://github.com/imfing/hextra/blob/v0.13.0/assets/js/head/theme.js
(() => {
  const root = document.documentElement;
  const sync = () => {
    root.dataset.theme = root.classList.contains('dark') ? 'dark' : 'light';
  };
  sync();
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] });
})();
