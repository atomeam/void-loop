// Backlog digest (asked by Verse): unbuilt asks grouped by family and evidence rating, own records only. node --test tools/backlog-digest.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { skillTable, skillsNamed, digestOf, digestHtml, daysWaiting, waitingOf } from '../void-live-deploy/lib/backlog-digest.js';
import skill from '../void-live-deploy/skills/backlog-digest.js';
const FAM = { families: [
  { id: 'games', name: 'Games <play>', skills: [{ name: 'chess', tier: 'proven' }, { name: 'go', tier: 'checked' }, { name: 'poker', tier: 'tested' }] },
  { id: 'self', name: 'Self', skills: [{ name: 'status', tier: 'checked' }, { name: 'incident-autopsy', tier: 'experiment' }, { name: 'incident', tier: 'proven' }] },
] };
const ASKS = [{ ask: "Add a 'match-replay' button to the chess history table" }, { ask: 'a poker tell for chess clocks' }, { ask: 'Use <b>incident autopsy</b> on the status card' }, { ask: 'make it nicer' }, { ask: '' }, null];

test('an ask names a skill by whole words, the longest name wins, a short or partial name never matches', () => {
  const t = skillTable(FAM);
  assert.deepEqual(skillsNamed('use incident autopsy here', t), ['incident-autopsy']);
  assert.deepEqual(skillsNamed('the chess board', t), ['chess']); assert.deepEqual(skillsNamed('chessboard and go', t), [], 'go is too short, chessboard is not chess');
});
test('groups by family, weakest evidence first, the unplaced last and never guessed', () => {
  const d = digestOf(ASKS, FAM);
  assert.equal(d.total, 4); assert.equal(d.placed, 3);
  assert.deepEqual(d.groups.map((g) => [g.id, g.tier, g.asks.length]), [['self', 'experiment', 1], ['games', 'tested', 2], ['none', '', 1]]);
  assert.deepEqual(digestOf(null, FAM).groups, []); assert.equal(digestOf([], null).total, 0);
});
test('the card escapes ask text and names, and an empty backlog says so', () => {
  const html = digestHtml(digestOf(ASKS, FAM), (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]));
  assert.ok(!html.includes('<b>incident') && !html.includes('Games <play>')); assert.match(html, /Games &lt;play&gt;/); assert.match(html, /weakest evidence: <b data-tier="experiment">/); assert.match(html, /No family yet/);
  assert.match(digestHtml(digestOf([], FAM), String), /every ask I made has been built/);
});
test('the real families.json places this backlog\'s own asks', () => {
  const fam = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8'));
  const d = digestOf([{ ask: "Add a 'match-replay' button to the chess history table with engine annotations" }, { ask: 'Create an incident-autopsy skill' }], fam);
  assert.ok(d.placed >= 1 && d.groups.every((g) => g.asks.length));
});
test('the skill takes its asks and leaves the plain backlog list to the wants card', () => {
  for (const a of ['digest your backlog', 'Backlog digest', 'summarise your unbuilt asks by family', 'group your open asks by family and evidence rating', 'asks by family', "digest verse's backlog"]) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of ['what is your backlog', 'digest my email', 'name all your unbuilt asks', 'your backlog']) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
test('velocity (asked by Verse): each ask says how many days it has waited unbuilt, the card gives the oldest and the median', () => {
  const NOW = Date.parse('2026-10-20T12:00:00Z');
  assert.equal(daysWaiting('2026-10-18T08:37:37Z', NOW), 2); assert.equal(daysWaiting('2026-10-20T11:00:00Z', NOW), 0);
  assert.equal(daysWaiting('', NOW), null); assert.equal(daysWaiting('nope', NOW), null); assert.equal(daysWaiting('2026-10-21T00:00:00Z', NOW), null, 'a future time is not a wait');
  assert.deepEqual(waitingOf([5, null, 1, 3]), { oldest: 5, median: 3, n: 3 }); assert.equal(waitingOf([null]), null); assert.equal(waitingOf([1, 4]).median, 3);
  const d = digestOf([{ ask: 'a chess clock', at: '2026-10-10T00:00:00Z' }, { ask: 'make it nicer', at: '2026-10-19T00:00:00Z' }, { ask: 'no time here' }], FAM, NOW);
  assert.deepEqual(d.groups.flatMap((g) => g.asks.map((a) => a.days)), [10, 1, null]); assert.deepEqual(d.waiting, { oldest: 10, median: 6, n: 2 });
  const html = digestHtml(d, String);
  assert.match(html, /data-oldest="10" data-median="6">Waiting unbuilt: the oldest 10 days, the median 6 days\./); assert.match(html, /<li data-days="1">make it nicer <span class="sub">· waiting 1 day<\/span>/);
  assert.match(html, /<li>no time here<\/li>/, 'an ask without a time says nothing about waiting');
  assert.ok(!digestHtml(digestOf([{ ask: 'x y' }], FAM, NOW), String).includes('Waiting unbuilt'));
});
