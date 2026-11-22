import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { layoutMap } from '../scripts/map-layout.mjs';

const snapshot = JSON.parse(await readFile(new URL('../data/org-map/repos.json', import.meta.url), 'utf8'));
const repo = (name, dependencies = []) => ({ name, group: 'tools', uses: dependencies.map(repo => ({ repo })) });
const fixture = repos => ({ groups: [{ id: 'tools', title: 'Tools' }], repos });
const edgeKey = edge => `${edge.from} → ${edge.to}`;

function points(path) {
  const result = [];
  const tokens = path.match(/[A-Z]|-?\d+(?:\.\d+)?/g);
  while (tokens.length) {
    const command = tokens.shift();
    const previous = result.at(-1);
    if (command === 'M') result.push([+tokens.shift(), +tokens.shift()]);
    else if (command === 'V') result.push([previous[0], +tokens.shift()]);
    else { assert.equal(command, 'H'); result.push([+tokens.shift(), previous[1]]); }
  }
  return result;
}

function checkGeometry(graph) {
  const segments = [];
  for (const node of graph.nodes) {
    for (const value of [node.x, node.y, node.width, node.height]) assert.ok(Number.isFinite(value) && value >= 0);
    assert.ok(node.x + node.width <= graph.width && node.y + node.height <= graph.height);
  }
  for (const edge of graph.edges) {
    const from = graph.nodes.find(node => node.name === edge.from);
    const to = graph.nodes.find(node => node.name === edge.to);
    const route = points(edge.path);
    assert.equal(route[0][1], from.y + from.height);
    assert.ok(route[0][0] > from.x && route[0][0] < from.x + from.width);
    assert.equal(route.at(-1)[1], to.y);
    assert.ok(route.at(-1)[0] > to.x && route.at(-1)[0] < to.x + to.width);
    for (const [x, y] of route) assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x <= graph.width && y <= graph.height);
    for (let index = 1; index < route.length; index++) {
      const [x1, y1] = route[index - 1];
      const [x2, y2] = route[index];
      const vertical = x1 === x2;
      assert.ok(vertical || y1 === y2, 'Paths must be orthogonal');
      const segment = { edge: edgeKey(edge), vertical, axis: vertical ? x1 : y1, low: Math.min(vertical ? y1 : x1, vertical ? y2 : x2), high: Math.max(vertical ? y1 : x1, vertical ? y2 : x2) };
      for (const other of segments) {
        if (other.edge !== segment.edge && other.vertical === vertical && other.axis === segment.axis) {
          assert.ok(Math.max(other.low, segment.low) >= Math.min(other.high, segment.high), `${segment.edge} overlaps ${other.edge}`);
        }
      }
      segments.push(segment);
      for (const node of graph.nodes) {
        const through = vertical
          ? x1 > node.x && x1 < node.x + node.width && Math.max(y1, y2) > node.y && Math.min(y1, y2) < node.y + node.height
          : y1 > node.y && y1 < node.y + node.height && Math.max(x1, x2) > node.x && Math.min(x1, x2) < node.x + node.width;
        assert.equal(through, false, `${edgeKey(edge)} crosses ${node.name}`);
      }
    }
  }
}

test('includes every recorded feed once, pointing from dependency to consumer', () => {
  const before = structuredClone(snapshot);
  const graph = layoutMap(snapshot);
  const expected = snapshot.repos.flatMap(consumer => consumer.uses.map(dependency => ({ from: dependency.repo, to: consumer.name })));
  const connected = new Set(expected.flatMap(edge => [edge.from, edge.to]));
  assert.equal(graph.edges.length, expected.length);
  assert.deepEqual(graph.edges.map(edgeKey).sort(), expected.map(edgeKey).sort());
  assert.deepEqual([...graph.nodes.map(node => node.name), ...graph.unconnected].sort(), snapshot.repos.map(repo => repo.name).sort());
  assert.deepEqual(graph.unconnected, snapshot.repos.filter(repo => !connected.has(repo.name)).map(repo => repo.name));
  assert.equal(graph.nodes.length, connected.size);
  const nodes = new Map(graph.nodes.map(node => [node.name, node]));
  for (const edge of graph.edges) assert.ok(nodes.get(edge.from).y < nodes.get(edge.to).y);
  assert.deepEqual(layoutMap(snapshot), graph);
  assert.deepEqual(snapshot, before);
  checkGeometry(graph);
});

test('groups roots near their immediate consumers before placing later rows', () => {
  const graph = layoutMap(fixture([
    repo('a'), repo('b'), repo('c'), repo('d'), repo('w', ['b', 'd']), repo('x', ['a']), repo('y', ['a']), repo('z', ['a', 'c']),
  ]));
  assert.deepEqual(graph.nodes.filter(node => node.y === 24).map(node => node.name), ['b', 'd', 'a', 'c']);
  checkGeometry(graph);
});

test('gives skipped-row feeds separate square routes and grows crowded gaps', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const graph = layoutMap(fixture(names.map((name, index) => repo(name, index > 1 ? ['a', names[index - 1]] : index ? ['a'] : []))));
  const skips = graph.edges.filter(edge => edge.path.match(/ H /g).length === 2);
  const lanes = skips.map(edge => points(edge.path)[2][0]);
  assert.equal(skips.length, names.length - 2);
  assert.equal(new Set(lanes).size, skips.length);
  assert.ok(Math.min(...graph.nodes.map(node => node.x)) > 24, 'More lanes expand the outer gutter');
  assert.ok(graph.nodes[1].y > 172, 'More tracks expand the gap between rows');
  checkGeometry(graph);
});

test('lays out new repositories, groups and long labels without fixed positions', () => {
  const longName = 'a-new-module-with-a-long-name';
  const map = fixture([repo('core'), repo('consumer', ['core']), repo('standalone'), repo(longName, ['core', 'consumer'])]);
  map.groups[0].title = 'An extended ownership group';
  const graph = layoutMap(map);
  assert.deepEqual(graph.unconnected, ['standalone']);
  assert.equal(graph.nodes.find(node => node.name === longName).width, longName.length * 8 + 24);
  assert.ok(graph.nodes.every(node => node.width >= map.groups[0].title.length * 6 + 24));
  for (const node of graph.nodes) assert.equal(node.x + node.width / 2, graph.width / 2);
  assert.deepEqual(['core', 'consumer', longName].map(name => graph.nodes.find(node => node.name === name).y), [24, 172, 320]);
  checkGeometry(graph);
  map.repos[2].uses.push({ repo: longName });
  const changed = layoutMap(map);
  assert.deepEqual(changed.unconnected, []);
  assert.equal(changed.nodes.find(node => node.name === 'standalone').y, 468);
  checkGeometry(changed);
});

test('keeps empty and entirely disconnected maps usable', () => {
  assert.deepEqual(layoutMap(fixture([])), { width: 48, height: 48, nodes: [], edges: [], unconnected: [] });
  const graph = layoutMap(fixture([repo('standalone'), repo('another')]));
  assert.deepEqual(graph.nodes, []);
  assert.deepEqual(graph.unconnected, ['standalone', 'another']);
});

test('rejects missing dependencies, duplicate names and cycles', () => {
  assert.throws(() => layoutMap(fixture([repo('a', ['missing'])])), /unknown dependency/i);
  assert.throws(() => layoutMap(fixture([repo('a'), repo('a')])), /duplicate/i);
  assert.throws(() => layoutMap(fixture([repo('a', ['b']), repo('b', ['a'])])), /cycle/i);
  assert.throws(() => layoutMap(fixture([repo('a', ['a'])])), /cycle/i);
});
