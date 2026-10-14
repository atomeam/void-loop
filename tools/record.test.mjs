// tools/record.mjs: what Void's own video of an experiment says comes from the lab entry and the run's ledger notes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runOf, script } from './record.mjs';
import { toolList } from '../void-live-deploy/skills/make.js';

const ledger = [{ run: 1, draft: 'drafts/fringe/miss-board-4.html', family: 'miss-board' }, { run: 2, draft: 'drafts/fringe/miss-board-4.html', family: 'miss-board', behavior: 'Estimate how much of what people ask Void has already seen.', hypothesis: 'Good-Turing says it', findings: ['about 40% unseen'], failure_modes: [{ what: 'small samples swing', evidence: 'n<30' }] }];
const run = runOf(ledger, 'miss-board-4');
assert.equal(run.run, 2, 'the newest run of a redone draft');
assert.equal(runOf(ledger, 'nope-1'), null);
const s = script({ id: 'miss-board-4', label: "What it hasn't heard yet", sub: 'How much of what people will ask has Void already seen?' }, run);
assert.equal(s.title, "Void built this: What it hasn't heard yet");
assert.equal(s.caption, 'Estimate how much of what people ask Void has already seen.', 'the ledger behavior is the caption');
assert.match(s.description, /What it set out to show: Good-Turing says it/);
assert.match(s.description, /What it found:\n- about 40% unseen/);
assert.match(s.description, /What failed:\n- small samples swing/);
assert.match(s.description, /https:\/\/a-to-mind\.com\/\?q=what%20it%20hasn't%20heard%20yet/);
assert.ok(s.title.length <= 100 && s.description.length <= 5000, "within YouTube's limits");
// with no notes, the lab's own line says what it is
assert.equal(script({ id: 'x-1', label: 'X', sub: 'A line.' }, null).caption, 'A line.');
// every lab experiment can be filmed: each has a page and a line to caption it with
const lab = toolList().filter((t) => /-\d+$/.test(t.id));
assert.ok(lab.length >= 12);
for (const t of lab) { readFileSync(new URL('../void-live-deploy/fringe/' + t.id + '.html', import.meta.url)); assert.ok(t.sub, t.id + ' has a line'); }
console.log('record: ok');
