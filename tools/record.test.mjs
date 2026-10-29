// tools/record.mjs: what Verse's own video of an experiment says comes from the lab entry and the run's ledger notes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runOf, script, hookOf, filmedOf, pickFilm, picksOf, sourceOf, shipsOf, shipId, unfilmed } from './record.mjs';
import { toolList } from '../void-live-deploy/skills/make.js';

const ledger = [{ run: 1, draft: 'drafts/fringe/miss-board-4.html', family: 'miss-board' }, { run: 2, draft: 'drafts/fringe/miss-board-4.html', family: 'miss-board', behavior: 'Estimate how much of what people ask Verse has already seen.', hypothesis: 'Good-Turing says it', findings: ['about 40% unseen'], failure_modes: [{ what: 'small samples swing', evidence: 'n<30' }] }];
const run = runOf(ledger, 'miss-board-4');
assert.equal(run.run, 2, 'the newest run of a redone draft');
assert.equal(runOf(ledger, 'nope-1'), null);
const s = script({ id: 'miss-board-4', label: "What it hasn't heard yet", sub: 'How much of what people will ask has Verse already seen?' }, run);
// an ad (owner, 2026-10-14): the experiment's own question as the hook, the link in the first line, #Shorts for reach
assert.equal(s.hook, 'How much of what people will ask has Verse already seen?', 'the name viewers see is Verse');
assert.equal(s.title, 'How much of what people will ask has Verse already seen? | an AI built this itself #Shorts');
assert.ok(s.description.startsWith(s.hook + ' Try it free: https://a-to-mind.com/'), 'hook and link before the fold');
assert.match(s.description, /#Shorts/); assert.ok(s.tags.includes('Shorts'));
assert.match(s.cta, /a\u2011to\u2011mind\.com/, 'the domain never breaks across lines');
assert.equal(hookOf({ label: 'X', sub: 'No question here.' }, { behavior: 'Does a thing.' }), 'Does a thing.', 'no question: the behavior');
assert.equal(s.caption, 'Estimate how much of what people ask Verse has already seen.', 'the ledger behavior is the caption');
assert.ok(!/\bVoid\b/.test(s.description) && /VERSE FILMS/.test(s.description) && s.tags.includes('Verse'), 'no Verse left in what a viewer reads');
assert.match(s.description, /What it set out to show: Good-Turing says it/);
assert.match(s.description, /What it found:\n- about 40% unseen/);
assert.match(s.description, /What failed:\n- small samples swing/);
assert.match(s.description, /https:\/\/a-to-mind\.com\/\?q=what%20it%20hasn't%20heard%20yet/);
assert.ok(s.title.length <= 100);
assert.ok(s.title.length <= 100 && s.description.length <= 5000, "within YouTube's limits");
// with no notes, the lab's own line says what it is
assert.equal(script({ id: 'x-1', label: 'X', sub: 'A line.' }, null).caption, 'A line.');
// every lab experiment can be filmed: each has a page and a line to caption it with
const lab = toolList().filter((t) => /-\d+$/.test(t.id));
assert.ok(lab.length >= 12);
for (const t of lab) { readFileSync(new URL('../void-live-deploy/fringe/' + t.id + '.html', import.meta.url)); assert.ok(t.sub, t.id + ' has a line'); }
console.log('record: ok');

// never the same film twice while another waits (owner, 2026-10-15: "these 3 are the same vid and nothing special")
{
  const tags = ['film-20261014-anomalous-event-timeline-4-r8', 'film-20261014-anomalous-event-timeline-4-r6', 'v1.2', 'film-20261013-miss-board-4-r3'];
  const filmed = filmedOf(tags);
  assert.deepEqual(filmed.map((f) => f.id), ['miss-board-4', 'anomalous-event-timeline-4', 'anomalous-event-timeline-4'], 'ids from tags, oldest first, other tags ignored');
  const lab = ['attention-7', 'miss-board-4', 'anomalous-event-timeline-4'];
  assert.equal(pickFilm(lab, []), 'anomalous-event-timeline-4', 'nothing filmed: the newest');
  assert.equal(pickFilm(lab, filmed), 'attention-7', 'the newest one not filmed yet, not the newest again');
  const all = filmedOf([...tags, 'film-20261016-attention-7-r9']);
  assert.equal(pickFilm(lab, all), 'miss-board-4', 'every one filmed: the one filmed longest ago');
  assert.equal(pickFilm(lab, filmedOf('film-20261014-attention-7-r1 film-20261014-miss-board-4-r2 film-20261014-anomalous-event-timeline-4-r3')), 'anomalous-event-timeline-4', 'a tie: the newest');
  // the real lab, with today's films: tomorrow's film is not the timeline again
  const real = toolList().filter((x) => /-\d+$/.test(x.id)).map((x) => x.id);
  assert.notEqual(pickFilm(real, filmed), 'anomalous-event-timeline-4');
}

// several films in one run, all different (owner, 2026-10-15: "Verse can make as many videos as it wants")
{
  const lab = ['a-1', 'b-2', 'c-3', 'd-4'];
  assert.deepEqual(picksOf(lab, filmedOf('film-20261014-d-4-r1'), 3), ['c-3', 'b-2', 'a-1'], 'three new ones, newest first');
  assert.deepEqual(picksOf(lab, filmedOf('film-20261014-d-4-r1'), 9), ['c-3', 'b-2', 'a-1', 'd-4'], 'never more than the lab, never one twice');
  assert.deepEqual(picksOf(lab, [], 0), ['d-4'], 'at least one');
}

// each film links to the code it shows (asked by Verse, 2026-10-15)
{
  const w = script({ id: 'miss-board-4', label: 'x', sub: 'y?' }, null);
  assert.equal(w.source, 'https://github.com/atomeam/void-loop/blob/main/void-live-deploy/fringe/miss-board-4.html');
  assert.ok(w.description.includes('How it is built: ' + sourceOf('miss-board-4')), 'the link is in the words a viewer reads');
  for (const x of toolList().filter((t) => /-\d+$/.test(t.id))) assert.ok(readFileSync(new URL('../void-live-deploy/fringe/' + x.id + '.html', import.meta.url)), 'every lab film links to a file that exists: ' + x.id);
}

// the payoff a viewer can check (2026-10-15): a "what it found" card with the run's own first finding, only when the ledger has one
{
  const { findingOf, FINDING_MAX } = await import('./record.mjs');
  assert.equal(s.finding, 'about 40% unseen', 'the first finding, word for word');
  assert.equal(script({ id: 'x-1', label: 'X', sub: 'A line.' }, null).finding, '', 'no run: no card');
  assert.equal(script({ id: 'x-1', label: 'X', sub: 'A line.' }, { findings: [] }).finding, '', 'no findings: no card');
  assert.equal(script({ id: 'x-1', label: 'X', sub: 'y' }, { findings: ['Verse misses 3 of 10 asks.', 'second'] }).finding, 'Verse misses 3 of 10 asks.', 'branded, the first only');
  // never cut (2026-10-22): the whole finding is kept and paginated at word boundaries, no page over FINDING_MAX, no "…"
  const { findingPages } = await import('./record.mjs');
  const long = 'The cue sped answers up when it pointed the right way. It slowed them down when it pointed the wrong way, every sitting, for every one of the people who tried it.';
  assert.equal(findingOf({ findings: [long] }), long, 'the whole finding');
  const pages = findingPages(long);
  assert.ok(pages.length > 1 && pages.every((p) => p.length <= FINDING_MAX && !p.includes('\u2026')), 'paginated, never cut: ' + JSON.stringify(pages));
  assert.equal(pages.join(' '), long, 'every word kept, in order');
}

// a film of a shipped change (2026-10-17): the lab ran out of experiments never filmed, so deploys filmed nothing
const g = [{ at: '2026-10-17T08:01:21Z', show: 'swaps show the minutes they add', try: 'what can i use instead of eggs in baking' }, { at: '2026-10-17T07:00:00Z', what: 'no show' }, { at: '2026-10-17T08:06:37Z', show: 'a pasted-back card says copy 2', try: 'open the book' }];
const sh = shipsOf(g);
assert.deepEqual(sh.map((x) => x.id), ['ship-202610170806', 'ship-202610170801'], 'newest first, only entries with a show and a try');
assert.equal(shipId(g[0]), 'ship-202610170801');
assert.equal(filmedOf('film-20261017-ship-202610170806-r9')[0].id, 'ship-202610170806', 'the release tag names the ship');
const ss = script(sh[1], null);
assert.match(ss.description, /\?q=what%20can%20i%20use%20instead%20of%20eggs/, 'the film links the ask, not the caption');
assert.match(ss.source, /void\.growth\.json$/);
assert.deepEqual(unfilmed(['a-1', 'b-2'], ['ship-2', 'ship-1'], new Set(['a-1', 'b-2']), 1, true, []), ['ship-2'], 'all lab filmed: a deploy films what shipped');
assert.deepEqual(unfilmed(['a-1'], ['ship-1'], new Set(['a-1', 'ship-1']), 1, true, []), [], 'a deploy with nothing new films nothing');
assert.deepEqual(unfilmed(['a-1'], [], new Set(['a-1']), 1, false, [{ id: 'a-1', day: '1' }]), ['a-1'], 'the daily run still falls back to the oldest film');
console.log('record: shipped-change films ok');
