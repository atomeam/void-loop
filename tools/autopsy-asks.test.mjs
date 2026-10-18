// Void's incident asks: the warning style lock, the Go-against-Verse log, the drill-down from a stability sparkline. Run: node --test tools/autopsy-asks.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { autopsy, autopsyHtml, GO_LOG, isGoLog } from '../void-live-deploy/lib/autopsy.js';
import { WARNING_LOCK } from '../void-live-deploy/lib/art-rules.js';
import { stabilityHtml, stabilitySeries } from '../void-live-deploy/skills/growth.js';
import skill from '../void-live-deploy/skills/incident-autopsy.js';

const FAM = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'clock' }, { name: 'countdown' }] }, { id: 'make', name: 'Making things', skills: [{ name: 'convert' }] }, { id: 'games', name: 'Games', skills: [{ name: 'go' }] }] };
const GUIDE = { pages: [] };
const SAMPLE = { incidents: [
  { at: '2026-10-17T10:00:00Z', sha: 'aaaaaaa1', suite: 'browser suite on main', checks: ['go against v01d: it replies to a move <b>x</b>', 'clock: "set it"'] },
  { at: '2026-10-17T09:00:00Z', sha: 'bbbbbbb2', suite: 'browser suite on main', checks: ['convert card: maths', 'go-ai: group in atari is taken'] },
] };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

test('the autopsy card is locked to the warning look: amber on black, a hazard stripe, a data attribute, on the empty card too', () => {
  const h = autopsyHtml(autopsy(SAMPLE, FAM, GUIDE)), e = autopsyHtml(autopsy({ incidents: [] }, FAM, GUIDE));
  for (const x of [h, e]) { assert.ok(x.includes('data-style-lock="warning"')); assert.ok(x.includes(WARNING_LOCK.css)); assert.ok(x.includes(WARNING_LOCK.stripe)); }
  assert.match(WARNING_LOCK.prompt, /high-contrast/);
  assert.ok(WARNING_LOCK.css.includes('#ffb000') && WARNING_LOCK.css.includes('#0b0b0b'));
});

test('failing Go-against-Verse checks are collected from the incidents, shown with a replay ask, escaped', () => {
  assert.ok(isGoLog('go against v01d: it replies')); assert.ok(isGoLog('go-ai: x')); assert.ok(!isGoLog('google: x')); assert.ok(!isGoLog('go to the shop'));
  const a = autopsy(SAMPLE, FAM, GUIDE); assert.deepEqual(a.goLog.map((g) => g.sha), ['aaaaaaa1', 'bbbbbbb2']);
  const h = autopsyHtml(a, esc); assert.match(h, /data-autopsy-golog="2"/); assert.ok(h.includes('data-ask="' + GO_LOG.replay + '"')); assert.ok(!h.includes('<b>x')); assert.match(h, /&lt;b>x/);
  assert.deepEqual(a.recent[0].checks[0], { text: 'go against v01d: it replies to a move <b>x</b>', skill: 'go', family: 'games' }, 'a Go check is placed with the go skill, in its family');
  const none = autopsy({ incidents: [{ at: '2026-10-17T10:00:00Z', sha: 'ccccccc3', checks: ['clock: x'] }] }, FAM, GUIDE);
  assert.equal(none.goLog.length, 0); assert.ok(!autopsyHtml(none).includes('data-autopsy-golog'));
});

test('a family focus keeps only that family\'s failing checks and incidents, and the family rows link to it', () => {
  const a = autopsy(SAMPLE, FAM, GUIDE, 'time');
  assert.equal(a.focus, 'time'); assert.equal(a.failing, 1); assert.deepEqual(a.recent.map((i) => i.sha), ['aaaaaaa1']); assert.deepEqual(a.families.map((f) => f.id), ['time']); assert.equal(a.unmapped.length, 0);
  const h = autopsyHtml(a); assert.match(h, /data-autopsy-focus="time"/); assert.match(h, /Only <b>Time<\/b>: 1 failing check/); assert.ok(h.includes('data-ask="incident autopsy"'));
  assert.ok(autopsyHtml(autopsy(SAMPLE, FAM, GUIDE)).includes('data-ask="incident autopsy for time"'));
  assert.equal(autopsy(SAMPLE, FAM, GUIDE, 'nope').failing, 0);
});

test('the skill reads "incident autopsy for <family>", and the near misses stay out', () => {
  assert.ok(skill.match('incident autopsy for time', 'incident autopsy for time')); assert.ok(skill.match('incident autopsy for making things', 'Incident autopsy for making things'));
  assert.ok(!skill.match('autopsy of a frog', 'autopsy of a frog')); assert.ok(skill.suite().ok);
});

test('each stability sparkline is a link that asks for its family\'s incident logs', () => {
  const fam = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'clock', tier: 'proven' }] }] };
  const h = stabilityHtml(esc, stabilitySeries([], fam, { recent: [] }));
  assert.match(h, /<a href="#" class="st-drill" data-ask="incident autopsy for time"[^>]*><svg class="st-spark"/);
});
