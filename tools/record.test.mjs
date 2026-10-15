// tools/record.mjs: what Void's own video of an experiment says comes from the lab entry and the run's ledger notes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runOf, script, hookOf, filmedOf, pickFilm, picksOf } from './record.mjs';
import { toolList } from '../void-live-deploy/skills/make.js';

const ledger = [{ run: 1, draft: 'drafts/fringe/miss-board-4.html', family: 'miss-board' }, { run: 2, draft: 'drafts/fringe/miss-board-4.html', family: 'miss-board', behavior: 'Estimate how much of what people ask Void has already seen.', hypothesis: 'Good-Turing says it', findings: ['about 40% unseen'], failure_modes: [{ what: 'small samples swing', evidence: 'n<30' }] }];
const run = runOf(ledger, 'miss-board-4');
assert.equal(run.run, 2, 'the newest run of a redone draft');
assert.equal(runOf(ledger, 'nope-1'), null);
const s = script({ id: 'miss-board-4', label: "What it hasn't heard yet", sub: 'How much of what people will ask has Void already seen?' }, run);
// an ad (owner, 2026-10-14): the experiment's own question as the hook, the link in the first line, #Shorts for reach
assert.equal(s.hook, 'How much of what people will ask has V01D already seen?', 'the name viewers see is V01D');
assert.equal(s.title, 'How much of what people will ask has V01D already seen? | an AI built this itself #Shorts');
assert.ok(s.description.startsWith(s.hook + ' Try it free: https://a-to-mind.com/'), 'hook and link before the fold');
assert.match(s.description, /#Shorts/); assert.ok(s.tags.includes('Shorts'));
assert.match(s.cta, /a\u2011to\u2011mind\.com/, 'the domain never breaks across lines');
assert.equal(hookOf({ label: 'X', sub: 'No question here.' }, { behavior: 'Does a thing.' }), 'Does a thing.', 'no question: the behavior');
assert.equal(s.caption, 'Estimate how much of what people ask V01D has already seen.', 'the ledger behavior is the caption');
assert.ok(!/\bVoid\b/.test(s.description) && /V01D FILMS/.test(s.description) && s.tags.includes('V01D'), 'no Void left in what a viewer reads');
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

// several films in one run, all different (owner, 2026-10-15: "V01D can make as many videos as it wants")
{
  const lab = ['a-1', 'b-2', 'c-3', 'd-4'];
  assert.deepEqual(picksOf(lab, filmedOf('film-20261014-d-4-r1'), 3), ['c-3', 'b-2', 'a-1'], 'three new ones, newest first');
  assert.deepEqual(picksOf(lab, filmedOf('film-20261014-d-4-r1'), 9), ['c-3', 'b-2', 'a-1', 'd-4'], 'never more than the lab, never one twice');
  assert.deepEqual(picksOf(lab, [], 0), ['d-4'], 'at least one');
}
