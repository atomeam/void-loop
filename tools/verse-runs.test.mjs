import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNS, MAX_AT_ONCE, select, distill, publicItems, checkpoint, asBlocks, actionableNews, dueReport, roundTrip, isDue } from '../void-live-deploy/lib/verse-runs.js';
import { blocksOf, publicBlocks } from '../void-live-deploy/lib/inbox-blocks.js';

const ev = { skills: 400, open: 'a tide chart for any harbour', floor: 'ndscalc.ru', misses: 3, news: 'Midterm data-center backlash hits' };
const sunday = new Date('2026-11-08T15:00:00Z'); // Sunday
const monday = new Date('2026-11-09T15:00:00Z');

test('fifteen runs, at most four at once, and a backlash headline is not a delivery ask', () => {
  assert.equal(RUNS.length, 15);
  assert.equal(actionableNews('Midterm data-center backlash hits'), null);
  assert.match(actionableNews('Workers AI outage: fix the free answer path'), /fix the free answer path/);
  const picked = select(RUNS, {}, sunday);
  assert.equal(picked.length, MAX_AT_ONCE);
  const again = select(RUNS, checkpoint({}, picked, sunday), sunday);
  assert.equal(again.length, MAX_AT_ONCE);
  assert.ok(again.every((r) => !picked.some((p) => p.id === r.id)));
});

test('owner runs stay off the public list, and the inbox parser drops a private block', () => {
  const rows = RUNS.map((r) => distill(r, ev));
  const pub = publicItems(rows);
  assert.ok(pub.length > 0);
  assert.equal(pub.some((r) => r.private), false);
  assert.ok(rows.find((r) => r.id === 'stamina').private);
  assert.equal(rows.find((r) => r.id === 'ai-news').skipped, 'not actionable');
  const text = asBlocks(rows, '2026-11-05');
  const kept = publicBlocks(blocksOf(text));
  assert.ok(kept.every((b) => !b.private));
  assert.deepEqual(roundTrip(text), kept.map((b) => b.ask));
  assert.equal(kept.some((b) => /stamina|eat and when to stop|weekly review/i.test(b.ask)), false);
});

test('the weekday hourly run is due on Monday, not on Sunday, and the model cap holds', () => {
  const hourly = RUNS.find((r) => r.id === 'growth-delivery');
  assert.equal(isDue(hourly, {}, monday), true);
  assert.equal(isDue(hourly, {}, sunday), false);
  const model = { id: 'model-run', every: 'daily', model: true, ask: () => 'x' };
  assert.equal(select([model], { day: '2026-11-09', calls: 20, last: {} }, monday).length, 0);
  assert.equal(dueReport(monday, ev).public.length <= MAX_AT_ONCE, true);
});

test('a pasted Growth inbox item block is read, and a private one is not', () => {
  const text = 'Growth inbox item\nstatus: open\nask: Practice one client discovery question on the handoff card\nsource: Client discovery practice\nprivate: no\n\nGrowth inbox item\nask: The owner weekly review\nprivate: yes\n';
  const rows = blocksOf(text);
  assert.equal(rows.length, 2);
  assert.equal(publicBlocks(rows).length, 1);
  assert.match(publicBlocks(rows)[0].ask, /client discovery/);
});

import { publicRuns, namedRun, isVerseRunsAsk, runsFact, nameKey } from '../void-live-deploy/lib/verse-runs.js';
import skill from '../void-live-deploy/skills/verse-runs.js';

test('public runs are findable by name, and personal names stay off the list', () => {
  assert.equal(publicRuns().length, 10);
  assert.equal(namedRun('Capability and platform scout').id, 'capability-scout');
  assert.equal(namedRun('Capability & platform scout').id, 'capability-scout');
  assert.equal(namedRun('Verse growth for business delivery').id, 'growth-delivery');
  assert.equal(namedRun('Execution stamina plan'), null);
  assert.equal(namedRun('Weekly fuel plan'), null);
  assert.equal(namedRun('Morning delivery brief'), null);
  assert.equal(nameKey('Capability & platform scout'), nameKey('Capability and platform scout'));
  assert.ok(isVerseRunsAsk('what automations does Verse run').list);
  assert.ok(isVerseRunsAsk("Verse's scheduled automations").list);
  assert.ok(isVerseRunsAsk('scheduled automations').list);
  assert.equal(isVerseRunsAsk('Capability and platform scout').run.id, 'capability-scout');
  assert.equal(isVerseRunsAsk('my automations'), null);
  assert.equal(isVerseRunsAsk('automations'), null);
  assert.equal(isVerseRunsAsk('automation status for invoice reminders'), null);
  assert.equal(isVerseRunsAsk('Execution stamina plan'), null);
  const fact = runsFact();
  assert.match(fact, /Capability and platform scout/);
  assert.match(fact, /Verse growth for business delivery/);
  assert.doesNotMatch(fact, /Execution stamina plan|Weekly fuel plan|Daily work plan|stamina|eat and when to stop/);
});

test('the card lists only public names', () => {
  let html = '';
  const ret = skill.run('Capability and platform scout', {
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; } }; fn(el); return el; },
  });
  return Promise.resolve(ret).then((name) => {
    assert.equal(name, 'verse-runs');
    assert.match(html, /Capability and platform scout/);
    assert.match(html, /Verse growth for business delivery/);
    assert.doesNotMatch(html, /Execution stamina plan|Weekly fuel plan|Daily work plan/);
  });
});

test('verse-runs examples reach it, and near misses do not', () => {
  for (const ex of skill.examples) assert.ok(skill.match(ex.toLowerCase(), ex), ex);
  for (const near of skill.nearMisses) assert.equal(skill.match(near.toLowerCase(), near), false, near);
});
