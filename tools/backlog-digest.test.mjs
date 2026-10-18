// Backlog digest (asked by Void): unbuilt asks grouped by family and evidence rating, own records only. node --test tools/backlog-digest.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { skillTable, skillsNamed, digestOf, digestHtml } from '../void-live-deploy/lib/backlog-digest.js';
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
  for (const a of ['digest your backlog', 'Backlog digest', 'summarise your unbuilt asks by family', 'group your open asks by family and evidence rating', 'asks by family']) assert.ok(skill.match(a.toLowerCase(), a), a);
  for (const a of ['what is your backlog', 'digest my email', 'name all your unbuilt asks', 'your backlog']) assert.ok(!skill.match(a.toLowerCase(), a), a);
});
