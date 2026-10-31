// lib/job-guide.js: every job Verse hands a team agent carries a spec (coordinator, 2026-10-30: Beam gave back two versus jobs,
// "No spec/template for 'versus' page creation in repo", because the hand-out carried only the short ask).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versusOf, versusSpec, willSpec, briefOf, SURFACES } from '../void-live-deploy/lib/job-guide.js';
import { assignText } from '../void-live-deploy/lib/team.js';

const NEW = { target: 'versus:wheelockweb.net', ask: 'Versus: wheelockweb.net (Wheelock) needs a page no floor has yet: a school site', note: 'claimed by Beam · tries 1' };
const ASPECT = { target: 'versus:diffuse.tools:speed', ask: 'Versus diffuse, speed: Verse loads in 2.1 s, the site in 0.9 s' };
const AGENT_ROOT = /your next job \(([a-z-]+), ([^)]*)\): ([\s\S]*?)\nAnswer in this thread/; // team/agent.mjs reads the assignment with this

test('a versus target names its host and, for a judged row, its aspect', () => {
  assert.deepEqual(versusOf('versus:wheelockweb.net'), { host: 'wheelockweb.net', aspect: '' });
  assert.deepEqual(versusOf('versus:diffuse.tools:speed'), { host: 'diffuse.tools', aspect: 'speed' });
  assert.deepEqual(versusOf('versus:tower-x'), { host: '', aspect: '' }, 'a name with no dot is no site, so no spec points at https://tower-x/');
  assert.equal(versusSpec({ target: 'versus:tower-x' }), '');
  assert.deepEqual(versusOf('versus:'), { host: '', aspect: '' });
  assert.equal(versusSpec({ target: 'versus:' }), '', 'no host, no spec');
});

test('a versus job for a site with no floor has the five parts of a spec', () => {
  const s = versusSpec(NEW);
  assert.match(s, /^Target: https:\/\/wheelockweb\.net\//m);
  assert.match(s, /^What to build: a new Verse page/m);
  assert.match(s, /never for the site: Verse's pages name no other site/);
  assert.match(s, /^Files to touch: void-live-deploy\/<slug>\/index\.html/m);
  for (const f of ['lib/toolkit.js', 'sw.js', 'lib/seo.js', 'docs/MAP.md', 'lib/tower.js', 'tools/tower-probes.mjs']) assert.ok(s.includes(f), f);
  assert.match(s, /^Verify: node --test tools\/<slug>\.test\.mjs/m);
  assert.match(s, /node tools\/checks\.mjs --changed/);
  const b = briefOf(NEW, 'versus');
  assert.ok(b.includes(s), 'the brief carries the spec');
  assert.match(b, /^Deliver: a pull request to atomeam\/void-loop main with the label automerge/m);
  assert.ok(!/data row on the shared page generator/.test(b), 'no family exists for this site, so the brief does not ask for a family row');
  assert.ok(!/tries \d|claimed by/i.test(b), 'the claim bookkeeping is not part of the note');
});

test('a versus job for one lost aspect points at the floor kit and that aspect only', () => {
  const s = versusSpec(ASPECT);
  assert.match(s, /^Target: https:\/\/diffuse\.tools\/ The ask names the aspect \(speed\)/m);
  assert.match(s, /node tools\/floor-kit\.mjs diffuse\.tools/);
  assert.match(s, /change nothing else on the page/);
  assert.match(s, /^Files to touch: /m);
  assert.match(s, /^Verify: /m);
});

test('the hand-out post carries the brief, and the agent still reads the job from its first line', () => {
  for (const j of [NEW, ASPECT, { target: 'feature:x', ask: 'Add a thing' }]) {
    const t = assignText('Beam', j), m = AGENT_ROOT.exec(t);
    assert.ok(m, 'the agent regex matches');
    assert.equal(m[2], j.target);
    assert.ok(t.includes('\n\nThe spec: '), 'the brief follows the assignment');
    assert.match(t, /\nDeliver: /);
    assert.ok(t.length <= 4000, 'a team message body is at most 4000 characters');
  }
});

// 2026-10-30: a team agent gave back "No spec/template for 'will:overhaul-surface-cards'"
const CARDS = { target: 'will:overhaul-surface-cards', ask: 'Overhaul surface:cards: persona playtest and best-site comparison, then rebuild what is weak', note: 'claimed by Beam · Verse chose this: its turn in this lap (before: skills 4, tests 1)' };

test('a will job that names a surface gets a spec: the surface, its skill files, how it is measured and how to verify', () => {
  const s = willSpec(CARDS, ['card', 'rally', 'weather', 'binder', 'collectible']);
  assert.match(s, /^Target: surface:cards/);
  assert.match(s, /void-live-deploy\/skills\/card\.js; void-live-deploy\/skills\/rally\.js; void-live-deploy\/skills\/binder\.js; void-live-deploy\/skills\/collectible\.js/);
  assert.doesNotMatch(s, /weather/);
  assert.match(s, /Measured by: skills 4, tests 1 .*Ship when one rises and none falls/);
  for (const part of ['What to build:', 'Files to touch:', 'Verify:']) assert.ok(s.includes(part), part);
});

test('without the skill list the spec names the files by their pattern; every lap item group has files; a will job naming no item gets none', () => {
  assert.match(willSpec(CARDS), /grep -E 'card\|rally\|duel\|collectible\|binder'/);
  assert.match(willSpec({ ask: 'Upgrade tool:lacks.mjs: more tests' }), /Files to touch: tools\/lacks\.mjs; tools\/lacks\.test\.mjs/);
  for (const g of ['skill', 'doc', 'plan', 'research', 'archive', 'site', 'loop']) assert.match(willSpec({ ask: 'Overhaul ' + g + ':x' }), /^Target: /, g);
  assert.match(willSpec({ ask: 'Overhaul surface:nowhere' }), /no surface is named nowhere/);
  assert.equal(willSpec({ ask: 'I want to answer every question about tides.' }), '');
  assert.ok(SURFACES.some(([n]) => n === 'cards'));
});

test('the brief a team agent gets for a will job carries the will spec', () => {
  const b = briefOf(CARDS, 'will');
  assert.match(b, /Target: surface:cards/); assert.match(b, /Deliver: a pull request/);
});
