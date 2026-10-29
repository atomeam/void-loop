// The wants card made plain (owner, 2026-10-29): a one-line definition of a want, an ask and an inbox item under each heading; what
// changed this lap; what is blocked and on what; the next pick with the evidence its picker uses; and the growth inbox in four
// workstreams by a keyword classifier (unsorted for what no rule takes). skills/wants.js; the browser check is "wants card" in
// tools/test_void.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEF, streamOf, streamsOf, blockedOf, changedOf, changedLine, nextOf, cardModel, cardHtml } from '../void-live-deploy/skills/wants.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the 19 open items of the growth inbox on 2026-10-29 (self.json `open`), each with the workstream it must land in
const INBOX = [
  ['Absorb and connect every repo', 'owner, 2026-10-15', 'platform'],
  ['Verse as a tool inside other AIs', 'void.plan.md Next #11', 'platform'],
  ['WebMCP origin trial', 'void.plan.md Now #5', 'platform'],
  ['Everything that passes through Verse is input', 'void.plan.md Next #14', 'platform'],
  ['Verse fixes any automation, as it is', 'void.plan.md Next #13', 'core'],
  ['Paid Verse', 'void.plan.md Next #12', 'growth'],
  ['Fix pages that bring buyers', 'claude, 2026-10-11', 'growth'],
  ['The best code reviewer, measured', 'owner, 2026-10-11', 'core'],
  ['Shared Voids, live', 'void.plan.md Next #10', 'core'],
  ['Tasks that keep running after you leave, with an approve card', 'void.assimilate.md row 3', 'core'],
  ['One owner page: board, agent log and live checks', 'void.assimilate.md row 9', 'platform'],
  ['Everything built before becomes a skill', 'void.plan.md Next #8', 'platform'],
  ['Pit crew: the crew chief (waits for the owner)', 'owner, 2026-10-11, pit crew plan', 'platform'],
  ['The growth inbox, deeper', 'asked by Verse, 2026-10-16; first slices live: skill health, family map, stability, divergence, bloom, last used on a…', 'reliability'],
  ['Two signposts left out until they can be true', 'claude, 2026-10-15, with the useful 404 and security.txt', 'growth'],
  ['The fast checks take 15 to 26 minutes (perf3d and glyphs run 11 to 13 minutes each): give the two longest browser…', 'claude 2026-10-18', 'reliability'],
  ['test_extension case B2 failed once while the machine was loaded, with the card still in its "arrive" animation: wait…', 'claude 2026-10-18', 'reliability'],
  ["Let a note's [[links]] reach the stage: a tap on a link opens that note in the notebook, and a note can be sent to the…", 'claude 2026-10-18', 'core'],
  ['Churn caps for the build loop: stop proposing changes to a file that has changed more than N times in M days', 'claude 2026-10-18', 'reliability'],
];
const open = INBOX.map(([ask, from]) => ({ state: 'open', date: '', ask, from }));

test('the workstream classifier puts every known inbox item in its group and an unknown one in "unsorted"', () => {
  for (const [text, from, want] of INBOX) assert.equal(streamOf({ text, from }), want, text);
  assert.equal(streamOf({ text: 'Teach Verse to juggle three oranges', from: 'claude 2026-10-29' }), 'unsorted');
  assert.equal(streamOf({ text: 'A new flaky test on the deploy', from: '' }), 'platform', 'the rules are tried in order: deploy is platform before test is reliability');
  assert.equal(streamOf({}), 'unsorted');
  const g = streamsOf([...INBOX.map(([text, from]) => ({ text, from })), { text: 'Teach Verse to juggle three oranges', from: '' }]);
  assert.deepEqual(g.map((x) => [x.id, x.items.length]), [['reliability', 4], ['core', 5], ['platform', 7], ['growth', 3], ['unsorted', 1]], 'shown in the owner\'s order, unsorted last');
  assert.equal(g[4].label, 'Unsorted (no rule matched)');
  assert.deepEqual(streamsOf([]), []);
});

test('the inbox block shows each workstream with its count, and an unsorted group only when something is unsorted', () => {
  const html = cardHtml(cardModel({ will: { wants: [] }, reflect: { asks: [] }, self: { open } }), esc);
  assert.match(html, /<p class="wants-streams" data-streams="[^"]*">Reliability 4 · Core experience 5 · Platform 7 · Growth 3<\/p>/);
  for (const [id, k] of [['reliability', 4], ['core', 5], ['platform', 7], ['growth', 3]]) assert.ok(html.includes('<div class="wants-group" data-stream="' + id + '" data-n="' + k + '">'), id);
  assert.ok(!html.includes('data-stream="unsorted"'));
  assert.equal((html.match(/class="wants-chip"/g) || []).length, 19, 'every item still a chip, once');
  const more = cardHtml(cardModel({ self: { open: [...open, { ask: 'Teach Verse to juggle three oranges', from: '' }] } }), esc);
  assert.ok(more.includes('<h4 class="wants-stream">Unsorted (no rule matched) (1)</h4>'));
});

test('the definitions render under each heading, in plain words that match what fills each list', () => {
  const html = cardHtml(cardModel({ will: { wants: [] }, reflect: { asks: [] }, self: { open: [] } }), esc);
  for (const id of ['wants', 'asks', 'inbox']) {
    const head = html.indexOf('<section class="wants-block" data-block="' + id + '"'), def = html.indexOf('<p class="wants-def" data-def="' + id + '" data-share-skip="1">' + esc(DEF[id]) + '</p>');
    assert.ok(head > 0 && def > head && def < html.indexOf('</section>', head), id + ': the definition sits under its own heading');
  }
  assert.match(DEF.wants, /^A want is something my will chose itself/); assert.match(DEF.wants, /ledger shows it built/);
  assert.match(DEF.asks, /^An ask is something I asked to have built, in my own reflections/);
  assert.match(DEF.inbox, /^An inbox item is an idea or plan item waiting in my growth inbox/);
  // a missing record still gets its definition: the reader learns what the list is even when it cannot be read
  assert.equal((cardHtml(cardModel({}), esc).match(/data-def="/g) || []).length, 3);
});

test('blocked: a held ask with its reason, the inbox line its hold names, and an inbox item that says what it waits for', () => {
  const asks = [{ ask: 'Integrate the join link with the growth skill', at: '2026-10-17T12:33:00Z', kind: 'build' }, { ask: 'Create a utility to check the watertightness of STL print files in the browser', at: '2026-10-28T22:29:00Z', kind: 'daily', small: true, held: 'sycophanthex.com' },
    { ask: 'Absorb every repository on the account into the core code', at: '2026-10-28T22:29:00Z', kind: 'daily', held: 'sycophanthex.com', heldFrontier: 'Absorb and connect every repo' }];
  const self = { open: open.map((o) => (/^(?:WebMCP|Paid Verse)/.test(o.ask) ? { ...o, waits: 'the owner' } : o)) };
  const m = cardModel({ will: { wants: [] }, reflect: { asks }, self });
  assert.deepEqual(m.blocked, [
    { text: 'Create a utility to check the watertightness of STL print files in the browser', kind: 'ask', waits: 'held until sycophanthex.com is beaten' },
    { text: 'Absorb every repository on the account into the core code', kind: 'ask', waits: 'held until sycophanthex.com is beaten' },
    { text: 'Absorb and connect every repo', kind: 'inbox', waits: 'held until sycophanthex.com is beaten' },
    { text: 'WebMCP origin trial', kind: 'inbox', waits: 'waits for the owner' },
    { text: 'Paid Verse', kind: 'inbox', waits: 'waits for the owner' },
  ]);
  const html = cardHtml(m, esc);
  assert.ok(html.includes('<h3 class="wants-h">Blocked (5)</h3>'));
  assert.ok(html.includes('<li data-kind="ask"><span class="wants-tag">Ask</span>Create a utility to check the watertightness of STL print files in the browser<small>held until sycophanthex.com is beaten</small></li>'));
  assert.ok(html.includes('>WebMCP origin trial<small data-share-short="(void.plan.md Now #5 · waits for the owner)">'), 'the inbox chip says what it waits for too, so a saved card keeps it');
  assert.deepEqual(blockedOf([{ text: 'a' }], [{ text: 'b' }]), []);
  assert.ok(cardHtml(cardModel({ will: { wants: [] }, reflect: { asks: [] }, self: { open: [] } }), esc).includes('Blocked (0)</h3><p class="wants-def">Nothing is held or waiting.</p>'));
});

test('changed this lap: the real counts from the lap, the asks built since it began, the last will job; "nothing changed" when nothing did', () => {
  const follow = { total: 244, built: 237, recent: [{ ask: 'Migrate answers to Gemma', at: '2026-10-25T01:16:56Z' }, { ask: 'Old one', at: '2026-10-20T00:00:00Z' }], asked: [{ ask: 'Migrate answers to Gemma', at: '2026-10-25T01:16:56Z' }, { ask: 'A story catalog', at: '2026-10-28T10:00:00Z' }] };
  const lap = { lap: 1, upgraded: 2, skills: 712, newThisLap: 1, newPerLap: 100, next: 'surface:cards', recent: ['surface:ask', 'surface:home'], since: '2026-10-22T09:00:00Z', line: 'Lap 1: upgraded 2 of 712 items, 1 of 100 new this lap' };
  const run = { title: 'Overhaul surface:ask: persona playtest', state: 'failed', at: '2026-10-29T05:00:00Z', shipped: false };
  const c = changedOf(lap, follow, run);
  assert.deepEqual(c, { lap: 1, upgraded: 2, added: 1, recent: ['surface:ask', 'surface:home'], since: '2026-10-22', built: ['Migrate answers to Gemma', 'A story catalog'], run: { title: 'Overhaul surface:ask: persona playtest', state: 'failed', shipped: false, at: '2026-10-29' } });
  assert.equal(changedLine(c), 'Lap 1 so far: 2 items sent for upgrade (newest: surface:ask, surface:home) · 1 new feature · 2 asks of mine built: Migrate answers to Gemma; A story catalog');
  const html = cardHtml(cardModel({ will: { wants: [], lap, lastRun: run }, reflect: { asks: [], follow }, self: { open: [] } }), esc);
  assert.ok(html.includes('<p class="wants-def" data-changed="5">Lap 1 so far: 2 items sent for upgrade'), 'the count is 2 + 1 + 2 from the records');
  assert.ok(html.includes('data-run="failed">The will&#39;s last job (2026-10-29): Overhaul surface:ask: persona playtest, failed, not shipped.</p>'));
  assert.ok(!html.includes('data-nosince'));
  // nothing changed: said plainly, with nothing made up
  const none = changedOf({ lap: 2, upgraded: 0, newThisLap: 0, recent: [], since: '2026-10-29T00:00:00Z' }, { recent: [{ ask: 'x', at: '2026-10-28T00:00:00Z' }] }, null);
  assert.equal(changedLine(none), 'Nothing changed this lap yet: no item sent for upgrade, no new feature, no ask of mine built.');
  assert.ok(cardHtml(cardModel({ will: { wants: [], lap: { lap: 2, upgraded: 0, newThisLap: 0, since: '2026-10-29T00:00:00Z' } }, reflect: { asks: [], follow: { recent: [] } }, self: { open: [] } }), esc).includes('data-changed="0">Nothing changed this lap yet'));
  // a lap whose start was not kept (lap 1 began before it was): asks built are not counted against it, and the card says so
  const old = changedOf({ lap: 1, upgraded: 2, newThisLap: 0, recent: ['surface:ask', 'surface:home'] }, follow, null);
  assert.equal(old.built, null); assert.equal(changedLine(old), 'Lap 1 so far: 2 items sent for upgrade (newest: surface:ask, surface:home) · 0 new features');
  assert.ok(cardHtml(cardModel({ will: { wants: [], lap: { lap: 1, upgraded: 2, newThisLap: 0, recent: ['surface:ask', 'surface:home'] } }, reflect: { asks: [], follow }, self: { open: [] } }), esc).includes('data-nosince="1"'));
  // no lap in the will, or no will: no number at all
  assert.equal(changedOf(null, follow, run), null); assert.equal(changedLine(null), '');
  assert.ok(cardHtml(cardModel({ will: { wants: [] }, reflect: { asks: [] }, self: { open: [] } }), esc).includes('data-nolap="1">My lap was not in my will just now'));
  assert.ok(cardHtml(cardModel({}), esc).includes('data-nolap="1">I could not read my will just now'));
});

test('next pick: the lap\'s next item and why, the open will job it waits for, the oldest ask not held, the Versus target; what is missing is named', () => {
  const lap = { lap: 1, upgraded: 2, skills: 712, newThisLap: 0, newPerLap: 100, next: 'surface:cards' };
  const asks = [{ text: 'Newer ask', at: '2026-10-20' }, { text: 'Oldest ask', at: '2026-10-17' }, { text: 'Held ask', at: '2026-10-01', held: 'sycophanthex.com' }];
  const tower = { target: 'sycophanthex.com', next: ['nameunit.com', 'wheelroot.com'], beaten: 0, total: 1266 };
  const p = nextOf({ lap, wants: [], asks, lastRun: { title: 'Overhaul surface:home', state: 'live' }, tower });
  assert.deepEqual(p.map((x) => x.id), ['will', 'ask', 'versus']);
  assert.equal(p[0].text, 'Upgrade surface:cards'); assert.match(p[0].why, /^Its turn in lap 1 \(2 of 712 taken; the lap takes every item once, most-used surfaces first/); assert.doesNotMatch(p[0].why, /open will job/);
  assert.equal(p[1].text, 'Oldest ask'); assert.match(p[1].why, /asked 2026-10-17\): my builders take the oldest first and pass over held ones/);
  assert.equal(p[2].text, 'sycophanthex.com'); assert.match(p[2].why, /then nameunit\.com \(smallest first, 0 of 1266 beaten\)/);
  assert.match(nextOf({ lap, asks, lastRun: { title: 'Overhaul surface:home', state: 'building' } })[0].why, /It is queued once the open will job is done: Overhaul surface:home \(building\)\./);
  const fresh = nextOf({ lap: { ...lap, next: null, upgraded: 712, newThisLap: 3 }, wants: [{ text: 'I want to learn tides.' }], asks: [] });
  assert.equal(fresh[0].text, 'New feature 4 of 100: I want to learn tides.'); assert.equal(fresh[1].missing, 'No ask of mine is waiting.');
  assert.equal(nextOf({ lap, asks: [asks[2]] })[1].missing, 'Every ask of mine left is held, so builders have none to take.');
  assert.equal(nextOf({ lap: null, asks: null })[0].missing, 'I cannot name my will\'s next pick: my lap was not in my will just now.');
  assert.equal(nextOf({ lap, asks: null, willRead: false })[0].missing, 'I cannot name my will\'s next pick: I could not read my will just now.');
  assert.equal(nextOf({ lap, asks: null })[1].missing, 'I cannot name the next ask: I could not read my asks just now.');
  assert.equal(nextOf({ lap, asks }).length, 2, 'no tower in self.json, no Versus line');
  const html = cardHtml(cardModel({ will: { wants: [], lap }, reflect: { asks: [{ ask: 'Oldest ask', at: '2026-10-17T00:00:00Z' }] }, self: { open: [], tower } }), esc);
  assert.ok(html.includes('<li data-pick="will"><span class="wants-tag">My will</span>Upgrade surface:cards<small>Its turn in lap 1'));
  assert.ok(html.includes('<li data-pick="ask"><span class="wants-tag">My builders</span>Oldest ask<small>'));
  assert.ok(html.includes('<li data-pick="versus"><span class="wants-tag">Versus</span>sycophanthex.com<small>'));
  assert.ok(cardHtml(cardModel({}), esc).includes('<li data-pick="will" data-nopick="1">'));
});
