// Progressive enhancement: the SVG links and full relationship list work alone.
for (const graph of document.querySelectorAll('.org-map-graph')) {
  const nodes = [...graph.querySelectorAll('[data-repo]')];
  const edges = [...graph.querySelectorAll('[data-from][data-to]')];
  let hovered = null;
  let focused = null;

  function update() {
    const selected = focused || hovered;
    const related = new Set([selected]);
    for (const edge of edges) {
      const active = edge.dataset.from === selected || edge.dataset.to === selected;
      if (active) {
        related.add(edge.dataset.from);
        related.add(edge.dataset.to);
      }
      edge.classList.toggle('is-active', active);
      edge.classList.toggle('is-muted', Boolean(selected) && !active);
    }
    for (const node of nodes) {
      node.classList.toggle('is-active', node.dataset.repo === selected);
      node.classList.toggle('is-muted', Boolean(selected) && !related.has(node.dataset.repo));
    }
  }

  const nameOf = target => target instanceof Element
    ? target.closest('[data-repo]')?.dataset.repo ?? null : null;
  graph.addEventListener('pointerover', event => { hovered = nameOf(event.target); update(); });
  graph.addEventListener('pointerleave', () => { hovered = null; update(); });
  graph.addEventListener('focusin', event => { focused = nameOf(event.target); update(); });
  graph.addEventListener('focusout', event => { focused = nameOf(event.relatedTarget); update(); });
}
