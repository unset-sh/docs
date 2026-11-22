import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkMap } from './update-map.mjs';

const nodeHeight = 80;
const gapX = 24;
const gapY = 68;
const padding = 24;

// Coordinates are presentation only: uses[] remains the source of every edge.
export function layoutMap(map) {
  const repos = new Map();
  const groups = new Map(map.groups.map(group => [group.id, group.title]));
  const connected = new Set();
  const edges = [];
  for (const repo of map.repos) {
    if (repos.has(repo.name)) throw new Error(`Duplicate repository: ${repo.name}`);
    repos.set(repo.name, repo);
  }
  for (const repo of map.repos) {
    for (const dependency of repo.uses) {
      if (!repos.has(dependency.repo)) throw new Error(`Unknown dependency: ${dependency.repo}`);
      connected.add(repo.name); connected.add(dependency.repo);
      edges.push({ from: dependency.repo, to: repo.name });
    }
  }

  const levels = new Map();
  const visiting = new Set();
  function level(name) {
    if (visiting.has(name)) throw new Error(`Dependency cycle at ${name}`);
    if (levels.has(name)) return levels.get(name);
    visiting.add(name);
    const dependencies = repos.get(name).uses;
    const depth = dependencies.length ? Math.max(...dependencies.map(edge => level(edge.repo))) + 1 : 0;
    visiting.delete(name); levels.set(name, depth);
    return depth;
  }
  map.repos.forEach(repo => level(repo.name));

  const rows = [];
  const unconnected = [];
  for (const repo of map.repos) {
    if (!connected.has(repo.name)) { unconnected.push(repo.name); continue; }
    const row = levels.get(repo.name);
    rows[row] ??= [];
    const width = Math.max(136, repo.name.length * 8 + 24, (groups.get(repo.group)?.length ?? 0) * 6 + 24);
    rows[row].push({ name: repo.name, width, height: nodeHeight });
  }
  if (rows.length > 1) {
    const consumerOrder = new Map(rows[1].map((node, index) => [node.name, index]));
    const consumerMean = node => {
      const consumers = edges.filter(edge => edge.from === node.name && consumerOrder.has(edge.to));
      return consumers.length ? consumers.reduce((sum, edge) => sum + consumerOrder.get(edge.to), 0) / consumers.length : Infinity;
    };
    rows[0].sort((a, b) => consumerMean(a) - consumerMean(b));
  }
  const rowWidth = row => row.reduce((sum, node) => sum + node.width, 0) + Math.max(0, row.length - 1) * gapX;
  let width = Math.max(0, ...rows.map(rowWidth)) + padding * 2;
  const height = rows.length ? rows.length * nodeHeight + (rows.length - 1) * gapY + padding * 2 : padding * 2;
  const placed = new Map();
  const nodes = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const barycenter = node => {
      const dependencies = repos.get(node.name).uses;
      return dependencies.length ? dependencies.reduce((sum, edge) => {
        const dependency = placed.get(edge.repo);
        return sum + dependency.x + dependency.width / 2;
      }, 0) / dependencies.length : 0;
    };
    // Stable ties preserve the upstream order and the root consumer grouping.
    row.sort((a, b) => barycenter(a) - barycenter(b));
    let x = (width - rowWidth(row)) / 2;
    for (const node of row) {
      node.x = x; node.y = padding + index * (nodeHeight + gapY);
      placed.set(node.name, node); nodes.push(node);
      x += node.width + gapX;
    }
  }
  const laneCounts = { left: 0, right: 0 };
  const skipLanes = new Map();
  for (const edge of edges.filter(edge => levels.get(edge.to) - levels.get(edge.from) > 1)) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    const side = from.x + from.width / 2 + to.x + to.width / 2 <= width ? 'left' : 'right';
    skipLanes.set(edge, { side, index: laneCounts[side]++ });
  }
  const extraPadding = Math.max(0, laneCounts.left - 2, laneCounts.right - 2) * 8;
  width += extraPadding * 2;
  nodes.forEach(node => { node.x += extraPadding; });
  for (const edge of edges) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    const startX = from.x + from.width / 2;
    const startY = from.y + from.height;
    const endX = to.x + to.width / 2;
    const exitY = startY + gapY / 2;
    if (levels.get(edge.to) - levels.get(edge.from) === 1) {
      edge.path = `M ${startX} ${startY} C ${startX} ${exitY} ${endX} ${to.y - gapY / 2} ${endX} ${to.y}`;
    } else {
      // Separate gutter lanes and curved entries keep feeds from sharing a bus.
      const lane = skipLanes.get(edge);
      const offset = padding / 2 + lane.index * 8;
      const laneX = lane.side === 'left' ? offset : width - offset;
      const enterY = to.y - gapY / 2;
      edge.path = `M ${startX} ${startY} C ${startX} ${exitY} ${laneX} ${startY} ${laneX} ${exitY} V ${enterY} C ${laneX} ${to.y} ${endX} ${enterY} ${endX} ${to.y}`;
    }
  }
  return { width, height, nodes, edges, unconnected };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 2) throw new Error('Usage: node scripts/map-layout.mjs');
    const graph = layoutMap(await checkMap());
    const directory = '.build/map/data/org-map';
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`);
    console.log(`Organisation graph: ${graph.nodes.length} connected repositories, ${graph.edges.length} feeds`);
  } catch (error) {
    console.error(error.message); process.exitCode = 1;
  }
}
