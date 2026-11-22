import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkMap } from './update-map.mjs';

const nodeHeight = 80;
const gapX = 24;
const gapY = 68;
const padding = 24;

const between = (x, a, b) => x > Math.min(a, b) && x < Math.max(a, b);
const crossings = (above, below) => Number(between(below.start, above.start, above.end)) + Number(between(above.end, below.start, below.end));
function orderTracks(tracks) {
  const ordered = [...tracks];
  // A few insertion passes remove avoidable crossings without searching permutations.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const track of tracks) {
      const previous = ordered.indexOf(track);
      ordered.splice(previous, 1);
      let best = ordered.reduce((sum, other, index) => sum + (index < previous ? crossings(other, track) : crossings(track, other)), 0);
      let cost = ordered.reduce((sum, other) => sum + crossings(track, other), 0);
      let position = previous;
      if (cost < best) { best = cost; position = 0; }
      for (let index = 0; index < ordered.length; index++) {
        cost += crossings(ordered[index], track) - crossings(track, ordered[index]);
        if (cost < best) { best = cost; position = index + 1; }
      }
      changed ||= position !== previous;
      ordered.splice(position, 0, track);
    }
    if (!changed) break;
  }
  return ordered;
}

function reservePort(request, occupied) {
  const minimum = request.node.x + 12;
  const maximum = request.node.x + request.node.width - 12;
  // Prefer visible separation; very dense future graphs can use finer ports.
  for (let spacing = 4; spacing > 0.000001; spacing /= 2) {
    for (let offset = 0; offset <= maximum - minimum; offset += spacing) {
      for (const direction of [1, -1]) {
        const x = Number((request.ideal + direction * offset).toFixed(6));
        if (x >= minimum && x <= maximum && occupied.every(other => Math.abs(other - x) >= spacing)) {
          occupied.push(x); return x;
        }
      }
    }
  }
  throw new Error('No space for a distinct graph port');
}

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
    const degree = Math.max(repo.uses.length, edges.filter(edge => edge.from === repo.name).length);
    const width = Math.max(136, repo.name.length * 8 + 24, (groups.get(repo.group)?.length ?? 0) * 6 + 24, (degree + 1) * 8 + 24);
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
  const tracks = Array.from({ length: Math.max(0, rows.length - 1) }, () => []);
  for (const edge of edges) {
    tracks[levels.get(edge.from)].push({ edge });
    if (levels.get(edge.to) - levels.get(edge.from) > 1) tracks[levels.get(edge.to) - 1].push({ edge });
  }
  const gaps = tracks.map(row => Math.max(gapY, 32 + (row.length - 1) * 12));
  const height = rows.length * nodeHeight + gaps.reduce((sum, gap) => sum + gap, 0) + padding * 2;
  const placed = new Map();
  const nodes = [];
  let y = padding;
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
      node.x = x; node.y = y;
      placed.set(node.name, node); nodes.push(node);
      x += node.width + gapX;
    }
    y += nodeHeight + (gaps[index] ?? 0);
  }
  const laneCounts = { left: 0, right: 0 };
  const skipLanes = new Map();
  const skips = edges.filter(edge => levels.get(edge.to) - levels.get(edge.from) > 1).map(edge => {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    const side = from.x + from.width / 2 + to.x + to.width / 2 <= width ? 'left' : 'right';
    return { edge, side, x: from.x + from.width / 2 };
  });
  skips.sort((a, b) => a.side.localeCompare(b.side) || (a.side === 'left' ? a.x - b.x : b.x - a.x));
  const occupiedLanes = [];
  for (const { edge, side } of skips) {
    const blockers = nodes.filter(node => levels.get(node.name) > levels.get(edge.from) && levels.get(node.name) < levels.get(edge.to)).sort((a, b) => a.x - b.x);
    const candidates = [];
    let cursor = padding;
    for (const node of [...blockers, { x: width - padding, width: 0 }]) {
      const midpoint = (cursor + node.x) / 2;
      for (let offset = 0; offset <= (node.x - cursor) / 2 - 8; offset += 8) {
        for (const direction of [1, -1]) candidates.push(midpoint + direction * offset);
      }
      cursor = Math.max(cursor, node.x + node.width);
    }
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    const distance = x => Math.abs(x - from.x - from.width / 2) + Math.abs(x - to.x - to.width / 2);
    const inversions = option => {
      const x = option.side ? (option.side === 'left' ? -width : width * 2) : option.x;
      return edges.filter(other => levels.get(other.to) - levels.get(other.from) === 1).reduce((sum, other) => {
        const start = placed.get(other.from);
        const end = placed.get(other.to);
        if (levels.get(other.from) === levels.get(edge.from) && other.from !== edge.from
          && (from.x + from.width / 2 - start.x - start.width / 2) * (x - end.x - end.width / 2) < 0) sum++;
        if (levels.get(other.to) === levels.get(edge.to) && other.to !== edge.to
          && (x - start.x - start.width / 2) * (to.x + to.width / 2 - end.x - end.width / 2) < 0) sum++;
        return sum;
      }, 0);
    };
    const options = candidates.filter(x => occupiedLanes.every(other => Math.abs(other - x) >= 8)).map(x => ({ x }));
    options.push({ side: 'left', x: padding / 2 + laneCounts.left * 8 }, { side: 'right', x: width - padding / 2 - laneCounts.right * 8 });
    options.sort((a, b) => inversions(a) - inversions(b) || Number(!!a.side) - Number(!!b.side) || distance(a.x) - distance(b.x));
    const choice = options[0];
    if (!choice.side) { occupiedLanes.push(choice.x); skipLanes.set(edge, { x: choice.x }); }
    else skipLanes.set(edge, { side: choice.side, index: laneCounts[choice.side]++ });
  }
  const extraPadding = Math.max(0, laneCounts.left - 2, laneCounts.right - 2) * 8;
  width += extraPadding * 2;
  nodes.forEach(node => { node.x += extraPadding; });
  const laneX = edge => {
    const lane = skipLanes.get(edge);
    if (lane.x !== undefined) return lane.x + extraPadding;
    const offset = padding / 2 + lane.index * 8;
    return lane.side === 'left' ? offset : width - offset;
  };
  const ports = new Map(edges.map(edge => [edge, {}]));
  const requests = tracks.map(() => []);
  for (const node of nodes) {
    for (const [key, own, other, gap] of [['start', 'from', 'to', levels.get(node.name)], ['end', 'to', 'from', levels.get(node.name) - 1]]) {
      const endpoint = edge => skipLanes.has(edge) ? laneX(edge) : placed.get(edge[other]).x + placed.get(edge[other]).width / 2;
      const connectedEdges = edges.filter(edge => edge[own] === node.name).sort((a, b) => endpoint(a) - endpoint(b));
      connectedEdges.forEach((edge, index) => requests[gap].push({ edge, key, node, ideal: node.x + 12 + (node.width - 24) * (index + 1) / (connectedEdges.length + 1) }));
    }
  }
  requests.forEach((row, index) => {
    const occupied = skips.filter(({ edge }) => levels.get(edge.from) <= index && levels.get(edge.to) > index).map(({ edge }) => laneX(edge));
    row.sort((a, b) => a.ideal - b.ideal).forEach(request => { ports.get(request.edge)[request.key] = reservePort(request, occupied); });
  });
  const horizontal = new Map(edges.map(edge => [edge, {}]));
  tracks.forEach((row, index) => {
    for (const track of row) {
      const { edge } = track;
      track.start = levels.get(edge.from) === index ? ports.get(edge).start : laneX(edge);
      track.end = levels.get(edge.to) === index + 1 ? ports.get(edge).end : laneX(edge);
    }
    const top = rows[index][0].y + nodeHeight;
    orderTracks(row).forEach((track, slot) => { horizontal.get(track.edge)[index] = top + (gaps[index] - (row.length - 1) * 12) / 2 + slot * 12; });
  });
  for (const edge of edges) {
    const from = placed.get(edge.from);
    const to = placed.get(edge.to);
    const startX = ports.get(edge).start;
    const startY = from.y + from.height;
    const endX = ports.get(edge).end;
    const exitY = horizontal.get(edge)[levels.get(edge.from)];
    if (levels.get(edge.to) - levels.get(edge.from) === 1) {
      edge.path = `M ${startX} ${startY} V ${exitY} H ${endX} V ${to.y}`;
    } else {
      const enterY = horizontal.get(edge)[levels.get(edge.to) - 1];
      edge.path = `M ${startX} ${startY} V ${exitY} H ${laneX(edge)} V ${enterY} H ${endX} V ${to.y}`;
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
