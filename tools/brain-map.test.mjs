// brain-map: the live map on /brain/ (owner, 2026-10-30: "really wow people by having things anyone can see and understand they are looking at
// a real functional brain"; 2026-10-29: "dont fake it"). A real brain, stepped: every turn and spark the map draws comes from a change in its
// runs or its working-memory writes, every sentence in the feed from a change in its state, and nothing moves between two equal reads.
// Run: node --test tools/brain-map.test.mjs. The page in a real browser: tools/real-pages.mjs '/brain/'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../void-live-deploy/lib/brain-map.js';
import * as B from '../void-live-deploy/lib/brain.js';
import { REGIONS_X, REGIONS_Y } from '../void-live-deploy/lib/brain-workspace.js';
import { ACTIONS } from '../void-live-deploy/lib/brain-organs.js';

const run = (b, n) => { for (let i = 0; i < n; i++) B.stepBrain(b, { over: true, x: 0.3 + 0.2 * Math.sin(i / 9), y: 0.5 + 0.2 * Math.cos(i / 7) }); };

test('its constants are the brain\'s own: the regions of the workspace and the actions of the will', () => {
  assert.equal(M.REGIONS_X, REGIONS_X); assert.equal(M.REGIONS_Y, REGIONS_Y);
  assert.deepEqual(M.ACTIONS, ACTIONS);
  const b = B.createBrain(3);
  assert.equal(b.ws.regionWrites.length, REGIONS_X * REGIONS_Y * (b.ws.organs.length + 1), 'one count per region per writer, the visitor last');
});

test('every organ is on the map once, in a lobe with a plain role, inside the map at a wide and a phone size', () => {
  const extra = B.ORGAN_IDS.concat(['someday']);
  for (const [w, h] of [[700, 520], [374, 430]]) {
    const L = M.layout(extra, w, h), placed = L.lobes.flatMap((l) => l.organs);
    assert.deepEqual([...placed].sort(), [...extra].sort(), 'each organ once, a new one too');
    assert.equal(L.wide, w >= h * 1.15);
    for (const id of extra) { const p = L.nodes[id]; assert.ok(p.x > 0 && p.x < w && p.y > 0 && p.y < h, id + ' inside ' + w + 'x' + h + ': ' + JSON.stringify(p)); }
    assert.equal(L.grid.cells.length, REGIONS_X * REGIONS_Y);
    for (const c of L.grid.cells) assert.ok(c.x >= 0 && c.x + c.w <= w + 0.5 && c.y >= 0 && c.y + c.h <= h + 0.5, 'a region of the working memory inside the map');
  }
  for (const id of B.ORGAN_IDS) assert.ok(M.ROLE[id], 'a plain role for ' + id);
});

test('a spark or a light only for a real turn or a real write, and nothing between two equal reads', () => {
  const b = B.createBrain(7); run(b, 30);
  const a = M.snap(b, B.selfOf(b));
  const same = M.snap(b, B.selfOf(b));
  const still = M.flowOf(a, same);
  assert.deepEqual(still.turns, {}); assert.equal(still.writes.length, 0); assert.equal(still.cells, 0);
  assert.deepEqual(M.eventsOf(a, same), [], 'no sentence without a change');
  run(b, 20); const z = M.snap(b, B.selfOf(b)), f = M.flowOf(a, z);
  assert.ok(Object.keys(f.turns).length > 0 && f.cells > 0, 'a working brain gives turns and writes');
  for (const [id, n] of Object.entries(f.turns)) assert.equal(n, z.runs[id] - a.runs[id], 'a turn is the count of its runs: ' + id);
  const W = z.organs.length + 1;
  for (const w of f.writes) { const o = w.organ === 'you' ? W - 1 : z.organs.indexOf(w.organ); assert.equal(w.n, z.rw[w.region * W + o] - a.rw[w.region * W + o], 'a write is the count of cells: ' + w.organ); }
  assert.equal(f.cells, f.writes.reduce((s, w) => s + w.n, 0));
  const c = M.countsOf(a, z, 1000, f);
  assert.equal(c.tps, 20, 'thoughts a second are its ticks a second');
  assert.equal(c.turns, Object.values(f.turns).reduce((s, v) => s + v, 0));
});

test('imagined futures leave no trace on the map: what imagine writes it puts back', () => {
  const b = B.createBrain(9); run(b, 12);
  const a = M.snap(b); B.imagine(b, { action: 'swirl', steps: 16 }); const z = M.snap(b);
  assert.deepEqual(z.rw, a.rw, 'the writes count only what really happened');
});

test('telling words gives the feed what really changed, and the path of the thought starts with you', () => {
  const b = B.createBrain(11); run(b, 10);
  const a = M.snap(b, B.selfOf(b)); B.ask(b, 'ocean maps'); const z = M.snap(b, B.selfOf(b));
  const ev = M.eventsOf(a, z), learned = ev.find((e) => e.kind === 'learned'), goal = ev.find((e) => e.kind === 'goal');
  assert.ok(learned && /"ocean"/.test(learned.text) && learned.organ === 'concepts', JSON.stringify(ev));
  assert.ok(goal && goal.organ === 'will', 'a word told is a goal too: ' + JSON.stringify(ev));
  for (const e of ev) assert.ok(M.ROLE[e.organ] || e.organ === 'attention', 'each sentence is about an organ on the map: ' + e.organ);
  const p = M.pathOf(ev, 'ocean maps');
  assert.equal(p[0].organ, 'you'); assert.match(p[0].text, /"ocean maps"/); assert.ok(p.length >= 3 && p.length <= 7);
  assert.deepEqual(M.pathOf([], 'x').length, 1);
});

test('a question is answered from its state, and an owner key is never told to it', () => {
  assert.ok(B.isQuestion('what are you doing?') && !B.isQuestion('ocean'));
  assert.ok(M.isKey('unlock abcdefghijklmnopqrstu') && !M.isKey('unlock the door'));
  const map = readFileSync(new URL('../void-live-deploy/brain/map.js', import.meta.url), 'utf8');
  assert.match(map, /if \(M\.isKey\(t\)\)[^\n]*return; \}/, 'the key is refused before anything else');
  assert.ok(!/fetch\(|localStorage\.setItem\(KEEP, (?!on)/.test(map), 'the map sends nothing and keeps only whether it is shown');
});

test('the page wires it: the map, its box and its button are on /brain/, and app.js hands it the one brain', () => {
  const html = readFileSync(new URL('../void-live-deploy/brain/index.html', import.meta.url), 'utf8');
  for (const id of ['mapView', 'map', 'feed', 'mapAsk', 'mapWord', 'viewBtn', 'mapCounts']) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /import '\/brain\/map\.js';/);
  assert.match(html, /body\.map-on #field \{ left: var\(--mapw, 0px\); \}/, 'the tissue moves over by the map, so neither covers the other');
  assert.match(readFileSync(new URL('../void-live-deploy/brain/app.js', import.meta.url), 'utf8'), /window\.verseBrainField = th;/);
});
