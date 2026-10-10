// node --test tools/growth-tree.test.mjs: the layout of Void's growth tree (void-live-deploy/skills/growth-tree.js, frontier
// #3) on a fixture ledger: one branch per entry, the same tree every time, the newest at the tips, a new entry only adds a
// branch, and the wood is shaped like a real tree's (on its parent, above the ground, thinning by the pipe model).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { layout, chronological, midpoint, timeline, season, leafColor, KIND_COLOR, TIP_RADIUS, PIPE, TRUNK } from '../void-live-deploy/skills/growth-tree.js';

const KINDS = ['grow', 'build', 'fix', 'idea', 'finding', 'retire'];
// 40 entries over 8 days, out of order in the file (the ledger allows that), plus three it must skip
const FIXTURE = Array.from({ length: 40 }, (_, i) => ({ at: new Date(Date.UTC(2026, 9, 1 + (i % 8), 9 + Math.floor(i / 8), i)).toISOString().replace('.000', ''), by: 'claude', kind: KINDS[(i * 7) % 6], what: 'entry ' + i }))
  .concat([{ at: 'not a time', by: 'x', kind: 'grow', what: 'undated' }, { at: '2026-10-02T00:00:00Z', by: 'x', kind: 'grow', what: '' }, null]);
const valid = FIXTURE.filter((e) => e && e.what && !isNaN(Date.parse(e.at)));
const T = layout(FIXTURE);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('one branch per dated entry; the oldest is the trunk; each keeps its ledger index and its kind colour', () => {
  assert.equal(T.branches.length, valid.length);
  const oldest = chronological(FIXTURE)[0];
  assert.equal(T.branches[0].index, oldest.index);
  assert.equal(T.branches[0].parent, -1);
  assert.deepEqual(T.branches[0].start, [0, 0, 0]);
  assert.equal(T.branches[0].length, TRUNK);
  for (const b of T.branches) {
    assert.equal(FIXTURE[b.index].at, b.at);
    assert.equal(b.color, KIND_COLOR[FIXTURE[b.index].kind]);
  }
  assert.equal(new Set(T.branches.map((b) => b.index)).size, T.branches.length, 'no entry twice');
});

test('the same ledger always makes the same tree, whatever order the file lists it in', () => {
  assert.deepEqual(layout(FIXTURE), T);
  assert.deepEqual(JSON.stringify(layout(JSON.parse(JSON.stringify(FIXTURE)))), JSON.stringify(T));
  const shuffled = valid.slice().reverse(), S = layout(shuffled);
  const key = (t, list) => t.branches.map((b) => list[b.index].what + '@' + b.start.join(',') + '>' + b.end.join(',')).join('|');
  assert.equal(key(S, shuffled), key(T, FIXTURE));
});

test('the newest are at the tips: every branch grows from an older one, and the newest entry has nothing growing from it', () => {
  for (const b of T.branches) for (const c of b.children) assert.ok(Date.parse(T.branches[c].at) >= Date.parse(b.at), 'a child older than its parent');
  const newest = T.branches.reduce((a, b) => (Date.parse(b.at) >= Date.parse(a.at) ? b : a));
  assert.equal(newest.children.length, 0);
  assert.ok(T.branches.filter((b) => !b.children.length).length >= T.branches.length / 3, 'a crown of tips, not a pole');
});

test('a new entry only adds a branch at a tip: every branch that grew before stays exactly where it was', () => {
  const later = FIXTURE.concat([{ at: '2026-10-20T12:00:00Z', by: 'claude', kind: 'grow', what: 'the newest thing' }]);
  const L = layout(later), added = L.branches.find((b) => b.index === later.length - 1);
  assert.equal(L.branches.length, T.branches.length + 1);
  assert.ok(added && added.children.length === 0);
  for (const b of T.branches) {
    const same = L.branches.find((x) => x.index === b.index);
    assert.deepEqual([same.start, same.end, same.parent], [b.start, b.end, b.parent]);
  }
  // the tree as it stood on a past day is the tree grown from the entries up to then (the time slider's hook)
  const until = '2026-10-04T23:59:59Z', past = layout(FIXTURE, { until });
  assert.equal(past.branches.length, valid.filter((e) => e.at <= until).length);
  for (const b of past.branches) assert.deepEqual(T.branches.find((x) => x.index === b.index).start, b.start);
});

test('shaped like a tree: each branch starts on its parent, nothing grows into the ground, wood thins by the pipe model', () => {
  for (const b of T.branches) {
    assert.ok(b.end[1] > 0.3 && b.start[1] >= 0, 'above ground');
    assert.ok(Math.abs(Math.hypot(...b.dir) - 1) < 1e-4);
    assert.ok(Math.abs(dist(b.start, b.end) - b.length) < 1e-4);
    if (b.parent >= 0) {
      const p = T.branches[b.parent], along = [0, 1, 2].reduce((s, k) => s + (b.start[k] - p.start[k]) * p.dir[k], 0) / p.length;
      const onAxis = p.start.map((x, k) => x + p.dir[k] * p.length * along);
      assert.ok(dist(onAxis, b.start) < 1e-4 && along > 0.3 && along < 1, 'sprouts from along its parent');
      assert.ok(b.length < p.length && b.radius < p.radius, 'smaller than what it grows from');
      const angle = Math.acos(Math.max(-1, Math.min(1, [0, 1, 2].reduce((s, k) => s + b.dir[k] * p.dir[k], 0)))) * 180 / Math.PI;
      assert.ok(angle > 5 && angle < 75, 'branches off at a real angle: ' + angle);
    }
    // the pipe model: a branch's cross-section feeds every branch above it
    const want = (TIP_RADIUS ** PIPE + b.children.reduce((s, c) => s + T.branches[c].radius ** PIPE, 0)) ** (1 / PIPE);
    assert.ok(Math.abs(b.radius - want) < 1e-9);
    // its profile runs base to tip, never thinner than a branch it carries before its highest fork, and ends in a twig
    assert.deepEqual(b.profile[0], [0, Math.round(b.radius * 1e6) / 1e6]);
    assert.equal(b.profile[b.profile.length - 1][0], 1);
    for (const c of b.children) assert.ok(b.profile[1][1] >= T.branches[c].radius - 1e-6);
  }
  assert.ok(T.branches[0].radius === Math.max(...T.branches.map((b) => b.radius)), 'the trunk is the thickest');
  assert.ok(T.height > TRUNK && T.width > 0.3);
  assert.deepEqual(midpoint(T.branches[0]), [0, 1, 2].map((k) => Math.round((T.branches[0].dir[k] * TRUNK / 2) * 1e6) / 1e6));
});

test('the real ledger makes a whole tree: a branch for every entry, a few metres tall, nothing out of bounds', () => {
  const ledger = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/void.growth.json', import.meta.url), 'utf8'));
  const R = layout(ledger);
  assert.equal(R.branches.length, chronological(ledger).length);
  assert.ok(R.height > 2 && R.height < 8 && R.width < 5, R.height + ' x ' + R.width);
  assert.ok(R.branches.every((b) => [...b.start, ...b.end, b.radius].every(Number.isFinite)));
  assert.ok(Math.max(...R.branches.map((b) => b.depth)) <= 8);
  assert.deepEqual(layout([]), { branches: [], ghosts: [], leaves: [], height: 0, width: 0 });
});

test('leaves are real leaves, coloured by the season of their date; the kind stays on the branch for its berry', () => {
  assert.deepEqual(['2026-04-02T00:00:00Z', '2026-07-01T00:00:00Z', '2026-09-10T00:00:00Z', '2026-10-05T00:00:00Z', '2026-11-20T00:00:00Z', '2026-01-15T00:00:00Z'].map(season), ['spring', 'summer', 'turning', 'autumn', 'late', 'winter']);
  for (const b of T.branches) {
    assert.ok(/^#[0-9a-f]{6}$/.test(b.leaf));
    assert.equal(leafColor(b.at, 0), leafColor(b.at, 0), 'the same day, the same palette');
    assert.ok(!Object.values(KIND_COLOR).includes(b.leaf), 'no leaf in a kind colour (no blue or purple leaves)');
  }
  const octo = T.branches.filter((b) => season(b.at) === 'autumn').map((b) => b.leaf);
  assert.ok(new Set(octo).size > 1, 'an autumn crown is mottled, not one flat colour');
});

test('ghosts: the open tracks and the claim being built are faint shoots off the real wood, and change nothing about it', () => {
  const tracks = [{ name: 'Living action figures', last: '2026-10-07' }, { name: 'Planet restoration', last: '2026-10-07' }];
  const building = { what: 'the time slider', at: '2026-10-10T02:00:00Z', item: 'Growth you can watch' };
  const G = layout(FIXTURE, { tracks, building });
  assert.deepEqual(G.branches, T.branches, 'the real tree is exactly the same with or without them');
  assert.deepEqual(G.ghosts.map((g) => g.kind + ':' + g.what), ['track:Living action figures', 'track:Planet restoration', 'building:the time slider']);
  for (const g of G.ghosts) {
    const p = G.branches[g.parent];
    assert.ok(p && !p.children.includes(g), 'grows from a real branch but is never one of its children');
    const along = [0, 1, 2].reduce((s, k) => s + (g.start[k] - p.start[k]) * p.dir[k], 0) / p.length;
    assert.ok(along > 0.3 && along < 1 && g.radius < TIP_RADIUS);
  }
  assert.deepEqual(layout(FIXTURE, { tracks, building }).ghosts, G.ghosts, 'they stay put');
  assert.equal(G.ghosts[2].item, 'Growth you can watch');
  assert.deepEqual(layout([], { tracks, building }).ghosts, [], 'no tree, nothing to grow from');
});

test('the time slider: the first stop is the first entry alone, then the end of every day to today; the last stop is the whole tree', () => {
  const now = Date.parse('2026-10-12T08:00:00Z'), stops = timeline(FIXTURE, now);
  assert.equal(stops[0].count, 1);
  assert.equal(layout(FIXTURE, { until: stops[0].until }).branches.length, 1);
  assert.equal(stops[0].until, chronological(FIXTURE)[0].e.at);
  assert.deepEqual(stops.slice(1).map((s) => s.day), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
  for (const s of stops) assert.equal(layout(FIXTURE, { until: s.until }).branches.length, s.count);
  assert.equal(stops[stops.length - 1].count, valid.length);
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].count >= stops[i - 1].count, 'the tree only grows');
  assert.deepEqual(timeline([]), []);
});

test('self.json carries the think tank\'s tracks and the claim being built now (tools/self-context.mjs)', async () => {
  const { readTracks, readBuilding } = await import('./self-context.mjs');
  const index = '| Track | File | Role |\n| --- | --- | --- |\n| Living action figures | `tracks/a.md` | Joints. Last advanced 2026-10-07 20:14 (arm). |\n| Planet restoration | `tracks/b.md` | Air. Last advanced 2026-10-06 (coral). |\n';
  assert.deepEqual(readTracks(index), [{ name: 'Living action figures', last: '2026-10-07' }, { name: 'Planet restoration', last: '2026-10-06' }]);
  const frontier = '## 3. Growth you can watch\n- **claim:** claude 2026-10-10: the `tree`, **shipped**\n## 4. A world\n- **claim:**\n## 5. Games\n- **claim:** claude 2026-10-09: self-play\n   - **claim (b):** grok 2026-10-10: a second piece\n';
  // without history, the latest date wins, then the lowest line; with git blame times, the line written last wins
  assert.deepEqual(readBuilding(frontier), { at: '2026-10-10T00:00:00Z', date: '2026-10-10', by: 'grok', item: 'Games', what: 'a second piece' });
  assert.deepEqual(readBuilding(frontier, { 2: '2026-10-10T05:00:00Z', 7: '2026-10-10T01:00:00Z' }), { at: '2026-10-10T05:00:00Z', date: '2026-10-10', by: 'claude', item: 'Growth you can watch', what: 'the tree, shipped' });
  assert.equal(readBuilding('## 1. x\n- **claim:**\n'), null);
  assert.equal(readBuilding('## 3. Growth\n- **claim:** claude 2026-10-11: **done.** card and tree\n'), null, 'a claim marked done is not being built');
  assert.equal(readBuilding('## 3. Growth\n- **claim:** claude 2026-10-11: **done.** x\n## 5. Games\n- **claim:** claude 2026-10-09: self-play\n').item, 'Games', 'the newest claim still open is');
});

test('the week: entries since 7 days ago, grouped by kind, in plain words, newest first; the tree\'s week-ago stop', async () => {
  const { weekSummary, plainly } = await import('../void-live-deploy/skills/growth-tree.js');
  const now = Date.parse('2026-10-10T12:00:00Z'), at = (d) => new Date(now - d * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  const L = [{ at: at(9), kind: 'grow', what: 'Chess' }, { at: at(5), kind: 'grow', what: 'Backgammon, the board game: you can play it now' }, { at: at(3), kind: 'build', what: 'The `weather` card: hourly rain' },
    { at: at(2), kind: 'grow', what: 'Ringer marbles. Flick and knock them out' }, { at: at(1), kind: 'fix', what: 'the timer (it stopped at 59 s)' }, { at: at(1), kind: 'idea', what: 'a sky that follows the hour' }];
  const w = weekSummary(L, now);
  assert.equal(w.since, '2026-10-03'); assert.equal(w.until, '2026-10-03T12:00:00Z'); assert.equal(w.total, 5);
  assert.deepEqual(w.groups.map((g) => [g.kind, g.count, g.label]), [['grow', 2, 'new things I can do'], ['build', 1, 'thing I do better'], ['fix', 1, 'thing I fixed'], ['idea', 1, 'idea']]);
  assert.deepEqual(w.groups[0].items, ['Ringer marbles', 'Backgammon, the board game'], 'newest first, each its first plain phrase');
  assert.equal(w.groups[1].items[0], 'The weather card', 'no Markdown');
  assert.equal(plainly('the timer (it stopped at 59 s)'), 'the timer (it stopped at 59 s)', 'too short to cut stays whole');
  assert.equal(plainly('CLOUDFLARE_API_TOKEN_2 is used now'), 'CLOUDFLARE_API_TOKEN_2 is used now', 'names keep their underscores');
  assert.match(w.text, /^Since 2026-10-03 \(the last 7 days\) I changed 5 things: 2 new things I can do, 1 thing I do better, 1 thing I fixed, 1 idea\. New things I can do: Ringer marbles; Backgammon, the board game\. Thing I do better: The weather card\. Thing I fixed: the timer \(it stopped at 59 s\)\.$/);
  assert.ok(!/Chess/.test(w.text), 'older than a week stays out');
  assert.equal(weekSummary(L.slice(0, 1), now).text, 'Nothing new in my growth ledger since 2026-10-03.');
  const many = weekSummary(Array.from({ length: 9 }, (_, i) => ({ at: at(1 + i * 0.1), kind: 'grow', what: 'thing number ' + i })), now);
  assert.match(many.text, /\(and 5 more\)/);
});

test('wants are buds until built: the glowing shoot while a claim builds them, gone once their grow line lands', async () => {
  const { wantState, saysTheSame } = await import('../void-live-deploy/skills/growth-tree.js');
  const want = 'Learn backgammon so people can play it';
  const building = { what: 'backgammon you can play against Void, first piece', item: 'Games', at: '2026-10-10T09:00:00Z' };
  const grown = FIXTURE.concat([{ at: '2026-10-11T09:00:00Z', by: 'claude', kind: 'grow', what: 'Backgammon, the board game: you can play it now' }]);
  assert.equal(wantState(want, FIXTURE, null), 'bud', 'a want without a ledger entry is a bud');
  assert.equal(wantState(want, FIXTURE, building), 'building');
  assert.equal(wantState(want, grown, building), 'grown', 'a built want stops being a bud, even while its claim line is still up');
  assert.ok(!saysTheSame('I want to answer every question about tides.', 'everyday benchmark: answer who-questions, weather where you are'), 'shared filler words are not the same thing');
  assert.ok(!saysTheSame('Better maps', 'the map card shows hills'), 'one short word says too little');
  const B = layout(FIXTURE, { wants: [want, { i_want: 'I want to answer every question about tides.' }] });
  assert.deepEqual(B.branches, T.branches, 'buds change nothing about the real tree');
  assert.deepEqual(B.ghosts.map((g) => g.kind), ['want', 'want'], 'a want without a ledger entry is a bud, not a branch');
  for (const g of B.ghosts) assert.ok(g.length < 0.1 && g.parent >= 0, 'a bud sits on a short stalk on real wood');
  const C = layout(FIXTURE, { wants: [want], building });
  assert.deepEqual(C.ghosts.map((g) => g.kind), ['building'], 'the want being built is the glowing shoot, not also a bud');
  assert.deepEqual(layout(grown, { wants: [want] }).ghosts, [], 'grown: no bud, it is a real branch now');
});

test('the last commits are new leaves on the branch of the ledger entry nearest them in time', async () => {
  const { readCommits } = await import('./self-context.mjs');
  const log = '2026-10-08T09:01:00+00:00\tFix the `clock` hands\n2026-10-03T12:00:00Z\tAdd **ringer**\nnot a commit line\n';
  const commits = readCommits(log);
  assert.deepEqual(commits, [{ at: '2026-10-08T09:01:00Z', subject: 'Fix the clock hands' }, { at: '2026-10-03T12:00:00Z', subject: 'Add ringer' }]);
  const L = layout(FIXTURE, { commits });
  assert.equal(L.leaves.length, 2);
  for (const c of L.leaves) {
    const t = Date.parse(c.at), d = (b) => Math.abs(Date.parse(b.at) - t), nearest = Math.min(...T.branches.map(d));
    assert.equal(d(T.branches[c.branch]), nearest, 'on the branch nearest in time');
    assert.equal(T.branches[c.branch].index, c.index);
    const b = T.branches[c.branch], tip = b.end;
    assert.ok(Math.hypot(c.pos[0] - tip[0], c.pos[1] - tip[1], c.pos[2] - tip[2]) < 0.1, 'at that branch\'s tip, where new growth comes');
  }
  assert.deepEqual(layout(FIXTURE, { commits }).leaves, L.leaves, 'they stay put');
  assert.deepEqual(L.branches, T.branches);
  assert.deepEqual(layout([], { commits }).leaves, []);
});
