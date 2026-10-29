import test from 'node:test';
import assert from 'node:assert/strict';
import { findings, jobOf, plan, skillOf, summary, readSkills, PREFIX } from './review-main.mjs';

test('the review of main reports bugs and risks in skill files, waived lines and skipped files left out, file then line', () => {
  const texts = {
    'zeta.js': "const a = 1;\nel.innerHTML = location.hash;\n",
    'alpha.js': "const x = eval(input);\nel.innerHTML = other; // void-review: ok\nif (a == b) {}\n",
    'mini/beta.js': "// void-review: skip-file\nconst y = eval(z);\n",
    'skipped.test.js': "const y = eval(z);\n",
  };
  const fs = findings(texts);
  assert.deepEqual(fs.map((f) => [f.file, f.line, f.kind, f.rule]), [['alpha.js', 1, 'risk', 'eval'], ['zeta.js', 2, 'risk', 'inner-html']]);
  assert.ok(fs.every((f) => f.message.length > 10));
  // a review that only finds style says nothing
  assert.deepEqual(findings({ 'a.js': 'x' }, () => ({ findings: [{ line: 1, kind: 'style', rule: 'x', message: 'm' }, { line: 1, kind: 'bug', rule: 'conflict-markers', message: 'm' }] })), []);
});

test('a finding becomes one job: review:<skill>, the ask Verse\'s own line (file, line, kind, rule, message), within the queue\'s limits', () => {
  const j = jobOf({ file: 'mini/chess.js', line: 12, kind: 'risk', rule: 'inner-html', message: 'putting a variable into innerHTML lets any HTML in it run' });
  assert.equal(j.target, 'review:chess');
  assert.equal(j.ask, 'review skills/mini/chess.js:12 (risk, inner-html): putting a variable into innerHTML lets any HTML in it run');
  assert.ok(j.ask.length <= 200 && j.note.length <= 300 && /not a visitor/.test(j.note));
  assert.equal(skillOf('forge-rules.js'), 'forge-rules');
  assert.equal(jobOf({ file: 'a.js', line: 1, kind: 'bug', rule: 'r', message: 'm'.repeat(400) }).ask.length, 200);
});

test('one review job open at a time; a finding queued once (open or done) is not queued again; the first new one goes', () => {
  const fs = [{ file: 'a.js', line: 1, kind: 'risk', rule: 'eval', message: 'm1' }, { file: 'b.js', line: 2, kind: 'bug', rule: 'x', message: 'm2' }, { file: 'c.js', line: 3, kind: 'bug', rule: 'y', message: 'm3' }];
  const [ja, jb] = fs.map(jobOf);
  assert.deepEqual(plan(fs, { items: [] }).queue.map((j) => j.target), ['review:a'], 'the first finding, only one');
  const done = { items: [{ target: ja.target, ask: ja.ask, state: 'live' }] };
  assert.deepEqual(plan(fs, done).queue.map((j) => j.target), ['review:b'], 'a done job is not repeated; the next finding goes');
  assert.equal(plan(fs, done).skipped, 1);
  const open = { items: [{ target: jb.target, ask: jb.ask, state: 'building' }] };
  const p = plan(fs, open);
  assert.deepEqual(p.queue, [], 'a review job is open: nothing more'); assert.equal(p.open, 1); assert.equal(p.fresh.length, 2);
  const other = { items: [{ target: 'probe:sky', ask: 'x', state: 'queued' }, { target: 'review:a', ask: 'an older finding on another line', state: 'needs-you' }] };
  assert.deepEqual(plan(fs, other).queue.map((j) => j.target), ['review:a'], 'probe jobs and a review job already settled do not block; a new line on the same skill is new work');
  assert.deepEqual(plan([], { items: [] }), { open: 0, fresh: [], queue: [], skipped: 0 });
  assert.match(summary({ found: 3, fresh: 2, queued: [ja], open: 0, dry: false }), /`review:a`/);
  assert.match(summary({ found: 3, fresh: 2, queued: [], open: 1, dry: true }), /none \(dry\)/);
});

test('the real skills are read (mini/ included) and reviewed without throwing; every job targets review:<skill>', () => {
  const texts = readSkills();
  assert.ok(Object.keys(texts).length > 100 && Object.keys(texts).some((f) => f.startsWith('mini/')));
  const fs = findings(texts);
  for (const f of fs) assert.ok(jobOf(f).target.startsWith(PREFIX) && jobOf(f).ask.startsWith('review skills/'));
});
