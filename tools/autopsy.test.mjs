// Incident autopsy: parser, mapping, counts, escaping (lib/autopsy.js). node --test tools/autopsy.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { parseIncidents, titleOf, skillOfCheck, autopsy, autopsyHtml, skillOfPath, suspectsOf } from '../void-live-deploy/lib/autopsy.js';
import skill from '../void-live-deploy/skills/incident-autopsy.js';
const FAM = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'clock' }, { name: 'countdown' }, { name: 'family-health' }] }, { id: 'make', name: 'Making <things>', skills: [{ name: 'appraise' }, { name: 'convert' }] }] };
const GUIDE = { pages: [{ name: 'appraise', examples: ['what is this coin worth'] }, { name: 'clock', examples: ['what time is it'] }, { name: 'convert', examples: ['what time is it'] }] };
const SAMPLE = { incidents: [
  { at: '2026-10-17T09:51:08.444Z', sha: '95164ec9caef7fdf87f0e19b0bef2aeeb5c8d16b', suite: 'browser suite on main', checks: ['convert card: maths, "temperature converter" opens it', 'zzz mystery: nothing matches'] },
  { at: '2026-10-17T09:00:00Z', sha: '4f660b32aa', suite: 'browser suite on main', checks: ['clock: "set it" <img src=x onerror=1>', 'convert card: again', 'the quoted "what is this coin worth" fails without a title'] },
  { at: 'not a date', sha: 'abcdef1', checks: ['x'] }, { at: '2026-10-17T08:00:00Z', sha: 'NOT-HEX', checks: ['x'] }, null, { at: '2026-10-17T08:00:00Z', sha: 'abcdef1', checks: 'oops' },
] };

test('the parser keeps only well-formed incidents, in the file\'s order', () => {
  const p = parseIncidents(SAMPLE); assert.deepEqual(p.map((i) => i.sha), ['95164ec9caef7fdf87f0e19b0bef2aeeb5c8d16b', '4f660b32aa']);
  assert.deepEqual(parseIncidents(null), []); assert.deepEqual(parseIncidents({}), []); assert.equal(parseIncidents(SAMPLE.incidents)[0].checks.length, 2);
});
test('a check is placed by its title or a quoted example ask, else it is unmapped', () => {
  assert.equal(titleOf('convert card: maths'), 'convert card'); assert.equal(titleOf('suite ran to the end now ok'), 'suite ran to the');
  const names = ['clock', 'convert', 'appraise', 'family-health', 'ab'];
  assert.equal(skillOfCheck('convert card: maths', names, GUIDE.pages), 'convert'); assert.equal(skillOfCheck('family health: the card', names, GUIDE.pages), 'family-health');
  assert.equal(skillOfCheck('big thing: "what is this coin worth" opens', names, GUIDE.pages), 'appraise');
  assert.equal(skillOfCheck('x: "what time is it"', names, GUIDE.pages), null, 'an example two skills share is not guessed');
  assert.equal(skillOfCheck('ab: tiny names never match', names, GUIDE.pages), null); assert.equal(skillOfCheck('reconvert: part of a word', names, GUIDE.pages), null);
  assert.equal(skillOfCheck('', names, null), null);
});
test('counts per family, latest incidents with their sha, unmapped listed', () => {
  const a = autopsy(SAMPLE, FAM, GUIDE);
  assert.equal(a.total, 2); assert.equal(a.failing, 5);
  assert.deepEqual(a.families, [{ id: 'make', name: 'Making <things>', count: 3 }, { id: 'time', name: 'Time', count: 1 }]);
  assert.deepEqual(a.unmapped.map((u) => u.text), ['zzz mystery: nothing matches']); assert.equal(a.recent[0].checks[0].family, 'make');
  assert.equal(autopsy({ incidents: [] }, FAM, GUIDE).total, 0); assert.equal(autopsy(undefined, null, null).failing, 0);
});
test('the markup escapes incident text and names, says the most failing family, and an empty file says so', () => {
  const html = autopsyHtml(autopsy(SAMPLE, FAM, GUIDE));
  assert.ok(!html.includes('<img') && !html.includes('Making <things>')); assert.match(html, /&lt;img/); assert.match(html, /Making &lt;things&gt;/);
  assert.match(html, /Most failing checks recorded: <b>Making/); assert.match(html, /<code>95164ec9<\/code>/); assert.match(html, /Unmapped/); assert.match(html, /&quot;temperature converter&quot;/);
  const none = autopsyHtml(autopsy({ incidents: [] }, FAM, GUIDE)); assert.match(none, /No incidents recorded/); assert.ok(!/\d/.test(none.replace(/<[^>]*>/g, '')));
});
test('the real incidents.json parses and every count adds up', () => {
  const real = JSON.parse(readFileSync(new URL('../void-live-deploy/incidents.json', import.meta.url), 'utf8')), fam = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/families.json', import.meta.url), 'utf8')), guide = JSON.parse(readFileSync(new URL('../void-live-deploy/skills/guide.json', import.meta.url), 'utf8'));
  const a = autopsy(real, fam, guide); assert.equal(a.total, real.incidents.length);
  assert.equal(a.families.reduce((n, f) => n + f.count, 0) + a.unmapped.reduce((n, u) => n + u.count, 0), a.failing);
});
test('the skill answers its examples and leaves its near misses alone', () => {
  for (const e of skill.examples) assert.ok(skill.match(e.toLowerCase(), e), e);
  for (const n of skill.nearMisses) assert.ok(!skill.match(n.toLowerCase(), n), n);
  assert.ok(skill.suite().ok);
});

import { pulseOf, pulseHtml } from '../void-live-deploy/lib/autopsy.js';
import { incidentRequest, suggestIncidentFix } from '../void-live-deploy/lib/correction-fix.js';
test('the pulse shows the latest incident, its sha and families, or says none was recorded', () => {
  const a = autopsy(SAMPLE, FAM, GUIDE), p = pulseOf(a);
  assert.equal(p.sha, '95164ec9caef7fdf87f0e19b0bef2aeeb5c8d16b'); assert.deepEqual(p.families, ['make']); assert.equal(p.unmapped, 1);
  const html = pulseHtml(a, undefined, { names: { make: 'Making <things>' } });
  assert.match(html, /<code>95164ec9<\/code>/); assert.match(html, /Making &lt;things&gt;/); assert.match(html, /1 unmapped/);
  assert.match(pulseHtml(autopsy({ incidents: [] }, FAM, GUIDE)), /No incidents recorded/); assert.equal(pulseOf(autopsy(undefined, null, null)), null);
});
test('a non-owner never sees the Suggest fix action; the owner sees it only on mapped checks', () => {
  const a = autopsy(SAMPLE, FAM, GUIDE);
  for (const o of [undefined, {}, { owner: false }]) assert.ok(!/incident-fix|Suggest fix/.test(pulseHtml(a, undefined, o)), JSON.stringify(o));
  const mine = pulseHtml(a, undefined, { owner: true });
  assert.equal((mine.match(/data-incident-fix=/g) || []).length, 1, 'one mapped check in the latest incident'); assert.match(mine, /data-incident-fix="0"/);
});
test('the incident request carries only the redacted check name, skill and family; it is refused without the owner key', async () => {
  const KEY = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0'; // secret-scan: ok: made-up key to test redaction
  const chk = { text: 'convert card ' + KEY + ': maths and "secret detail" after the colon', skill: 'convert', family: 'make' };
  const req = incidentRequest(chk, FAM, 'x'.repeat(60));
  assert.deepEqual(Object.keys(req).sort(), ['ask', 'mode', 'said', 'skill', 'source']); assert.equal(req.skill, 'convert'); assert.match(req.said, /family: make/);
  assert.ok(!JSON.stringify(req).includes(KEY) && !JSON.stringify(req).includes('secret detail'), 'masked, and only the name before the colon');
  assert.equal(incidentRequest({ text: 'x: y', skill: null }, FAM, 's'), null);
  let calls = 0; const f = async () => { calls++; return { ok: true, text: async () => 'x'.repeat(60), json: async () => ({ edits: [], why: '' }) }; };
  assert.equal((await suggestIncidentFix(chk, FAM, { owner: '', fetchFn: f })).got.ok, false); assert.equal(calls, 0);
  assert.equal((await suggestIncidentFix(chk, FAM, { owner: 'k', fetchFn: f })).got.ok, true); assert.equal(calls, 2);
});
test('a test case from each recent failure (asked by Verse): the ask the check quotes, else the skill\'s own example; newest first, one per skill, unmapped checks skipped', async () => {
  const { autopsy, incidentCases } = await import('../void-live-deploy/lib/autopsy.js');
  const fam = { families: [{ id: 'stage', name: 'The stage', skills: [{ name: 'label' }, { name: 'timer' }] }] };
  const guide = { pages: [{ kind: 'skill', name: 'label', examples: ['label it'] }, { kind: 'skill', name: 'timer', examples: ['timer', 'set a timer for 2 minutes'] }] };
  const inc = { incidents: [
    { at: '2026-10-17T22:00:00Z', sha: 'aaaaaaa1', checks: ['timer: the countdown stops at zero', 'label: "label the clock kitchen" tags it', 'check timeout: no check finished within 300 s'] },
    { at: '2026-10-17T21:00:00Z', sha: 'bbbbbbb2', checks: ['timer: an older failure'] },
  ] };
  const c = incidentCases(autopsy(inc, fam, guide), guide);
  assert.deepEqual(c.map((x) => [x.skill, x.ask, x.sha]), [['timer', 'set a timer for 2 minutes', 'aaaaaaa'], ['label', 'label the clock kitchen', 'aaaaaaa']], 'the quoted ask wins; one case per skill, from its newest failure; the timeout matches no skill');
  assert.equal(c[1].check, 'label'); assert.equal(incidentCases(autopsy(inc, fam, guide), guide, 1).length, 1); assert.deepEqual(incidentCases(null, guide), []);
});

test('stability gauge: red suites in the last week lower the score; none is steady (asked by Verse)', async () => {
  const { stabilityOf, stabilityHtml } = await import('../void-live-deploy/lib/autopsy.js');
  const now = Date.parse('2026-10-18T12:00:00Z'), mk = (...ats) => ({ incidents: ats.map((at, n) => ({ at, sha: 'abcdef' + n, checks: ['x'] })) });
  assert.deepEqual(stabilityOf(mk('2026-09-01T00:00:00Z'), now), { score: 100, label: 'steady', week: 0, day: 0, known: 1, last: null, checks: 0, capped: false, fixed: 0 });
  const g = stabilityOf(mk('2026-10-18T06:00:00Z', '2026-10-15T00:00:00Z', '2026-10-01T00:00:00Z'), now); assert.deepEqual([g.score, g.label, g.week, g.day, g.last], [91, 'wobbly', 2, 1, 6]);
  assert.equal(stabilityOf(mk(...Array(9).fill('2026-10-18T11:00:00Z')), now).score, 0); assert.equal(stabilityOf(mk(...Array(9).fill('2026-10-18T11:00:00Z')), now).label, 'shaky');
  // a bad morning fades: 30 reds, then main stays green; a day later the dial is climbing, two days later it is nearly steady
  const bad = mk(...Array(30).fill('2026-10-18T12:00:00Z'));
  assert.equal(stabilityOf(bad, now).score, 0);
  assert.equal(stabilityOf(bad, now + 864e5).score, 10); assert.equal(stabilityOf(bad, now + 2 * 864e5).score, 78); assert.equal(stabilityOf(bad, now + 3 * 864e5).label, 'wobbly');
  assert.equal(stabilityOf(mk('2027-01-01T00:00:00Z'), now).week, 0, 'a time in the future is not counted');
  assert.match(stabilityHtml(g), /data-stability="wobbly"/); assert.match(stabilityHtml(stabilityOf(null, now)), /data-stability="none"/); assert.match(stabilityHtml(g), /width:91%/);
});

test('stability gauge: a full incidents.json says "at least", and the red suites name how many different checks failed (asked in review)', async () => {
  const { stabilityOf, stabilityHtml, INCIDENTS_KEPT } = await import('../void-live-deploy/lib/autopsy.js');
  const { KEEP } = await import('./incident-log.mjs');
  assert.equal(INCIDENTS_KEPT, KEEP, 'the gauge knows how many red suites the log keeps');
  const now = Date.parse('2026-10-18T12:00:00Z'), at = (h) => new Date(now - h * 36e5).toISOString();
  // one break seen on 29 pushes, plus a stall and one more check: 30 red suites, 2 different checks, every red suite still costs
  const full = { incidents: Array.from({ length: 30 }, (_, n) => ({ at: at(n), sha: 'abcdef' + String(n).padStart(2, '0'), checks: n === 0 ? ['suite ran to the end'] : n === 1 ? ['book opens', 'clock ticks'] : ['book opens'] })) };
  const g = stabilityOf(full, now);
  assert.deepEqual([g.week, g.checks, g.capped, g.score, g.label], [30, 2, true, 0, 'shaky'], 'the stall is not a check; the score is the same as before');
  const said = stabilityHtml(g).replace(/<[^>]+>/g, '');
  assert.match(said, /^Stability: shaky 0\/100At least 30 red runs of the browser checks on main this week \(\d+ in the last 24 hours\), with 2 different checks failing\.$/);
  assert.doesNotMatch(said, /incidents\.json|suites/, 'the card says it in plain words, no file names (owner, 2026-10-30)');
  // the same file with its oldest red suite more than a week old: the week is counted in full, so no "at least"
  full.incidents[29].at = at(24 * 8); const h = stabilityOf(full, now);
  assert.deepEqual([h.week, h.capped], [29, false]); assert.doesNotMatch(stabilityHtml(h), /At least|keeps only/);
  // fewer than the log keeps: never "at least"
  assert.equal(stabilityOf({ incidents: full.incidents.slice(0, 5) }, now).capped, false);
  // nothing failing that counts: one plain line, with the fixed ones said once (owner, 2026-10-30: "No failing checks on main this week")
  for (const i of full.incidents) i.closedAt = at(0);
  const z = stabilityOf(full, now); assert.equal(z.week, 0);
  assert.equal(stabilityHtml(z).replace(/<[^>]+>/g, '').replace(/^Stability: \w+ \d+\/100/, ''), 'No failing checks on main this week. 29 earlier red runs were fixed by a later green run.');
  assert.doesNotMatch(stabilityHtml(z), /At least 0/);
});
test('culprit pointer: a changed skill file whose skill has a failing check is the likely cause; none changed says so (asked by Verse)', () => {
  assert.equal(skillOfPath('void-live-deploy/skills/convert.js'), 'convert'); assert.equal(skillOfPath('void-live-deploy/skills/order/0480-watch'), null); assert.equal(skillOfPath('tools/convert.js'), null);
  const sus = suspectsOf(['tools/x.mjs', 'void-live-deploy/skills/clock.js', 'void-live-deploy/skills/convert.js'], [{ skill: 'convert' }, { skill: null }]);
  assert.deepEqual(sus.map((s) => [s.skill, s.likely]), [['convert', true], ['clock', false]]);
  const inc = (touched) => ({ incidents: [{ at: '2026-10-17T09:51:08Z', sha: '95164ec9caef', suite: 's', checks: ['convert card: maths'], touched }] });
  let h = autopsyHtml(autopsy(inc(['void-live-deploy/skills/convert.js', 'a<b.js']), FAM, GUIDE));
  assert.match(h, /data-culprit="likely"/); assert.match(h, /Likely cause: <code>skills\/convert\.js<\/code> \(has a failing check\)/); assert.ok(!h.includes('a<b'));
  h = autopsyHtml(autopsy(inc(['domains/x.md']), FAM, GUIDE)); assert.match(h, /data-culprit="none"/); assert.match(h, /No skill file changed/);
  h = autopsyHtml(autopsy(inc(undefined), FAM, GUIDE)); assert.ok(!h.includes('data-culprit'), 'paths never recorded say nothing');
});

test('the suite\'s own stalls and end-of-run flags are counted apart, never unmapped, never in a family or the garden', async () => {
  const { isSuiteMeta, failurePlants } = await import('../void-live-deploy/lib/autopsy.js');
  const J = { incidents: [
    { at: '2026-10-17T09:00:00Z', sha: 'aaaaaaa1', suite: 's', checks: ['check timeout: no check finished within 300 s', 'clock: "set it" fails', 'suite ran to the end'] },
    { at: '2026-10-17T08:00:00Z', sha: 'bbbbbbb2', suite: 's', checks: ['check timeout: no check finished within 300 s'] },
  ] };
  assert.ok(isSuiteMeta('check timeout: no check finished within 300 s') && isSuiteMeta('suite ran to the end') && !isSuiteMeta('clock: check timeout') && !isSuiteMeta(''));
  const a = autopsy(J, FAM, GUIDE);
  assert.deepEqual(a.suite, { timeouts: 2, ended: 1, incidents: 2, stalled: 2, threshold: 3, escalated: false }); assert.equal(a.failing, 1); assert.deepEqual(a.unmapped, []);
  assert.equal(a.recent[0].checks.filter((c) => c.meta).length, 2);
  const h = autopsyHtml(a, (s) => String(s)); assert.ok(h.includes('data-autopsy-suite') && h.includes('2 stalled checks') && h.includes('(the suite itself)'));
  assert.deepEqual(failurePlants(J).map((x) => x.text), ['clock']);
  assert.ok(!autopsyHtml(autopsy(SAMPLE, FAM, GUIDE), (s) => String(s)).includes('data-autopsy-suite'));
});

test('failure signature: a check that failed on an earlier red suite is recurring (not this commit), a first failure is new, only stalls are the suite (asked by Verse)', async () => {
  const { signatureOf, signatureLine, autopsy, autopsyHtml, pulseHtml } = await import('../void-live-deploy/lib/autopsy.js');
  const inc = [
    { at: '2026-10-19T07:22:27Z', sha: '4841759', suite: 'browser suite on main', checks: ['fly stars move: drift', 'grown: 21 asks', 'check timeout: no check finished within 300 s'] },
    { at: '2026-10-18T13:16:33Z', sha: '8322451', suite: 'browser suite on main', checks: ['fly stars move: drift', 'grown: 21 asks'] },
    { at: '2026-10-18T12:39:28Z', sha: '3afe77b', suite: 'browser suite on main', checks: ['grown: 21 asks', 'feelings: plain answer'] },
    { at: '2026-10-17T10:00:00Z', sha: 'aaaaaaa', suite: 'browser suite on main', checks: ['check timeout: no check finished within 300 s'] },
  ];
  const r = signatureOf(inc, 0), m = signatureOf(inc, 1), n = signatureOf(inc, 2), su = signatureOf(inc, 3);
  assert.equal(r.kind, 'recurring'); assert.equal(r.seen, 2); assert.equal(r.since, '2026-10-18T12:39:28Z');
  assert.equal(m.kind, 'mixed'); assert.deepEqual(m.fresh, ['fly stars move']);
  assert.equal(n.kind, 'new'); assert.equal(su.kind, 'suite');
  assert.match(signatureLine(r), /^Recurring: every failing check also failed on 2 earlier red suites \(since 2026-10-18\), so not this commit's doing\.$/);
  assert.match(signatureLine(n), /^New: none of these checks failed before/);
  const a = autopsy(inc, { families: [] }, { pages: [] });
  assert.equal(a.recent[0].signature.kind, 'recurring');
  assert.match(autopsyHtml(a), /data-signature="recurring">Recurring: /);
  assert.match(pulseHtml(a), /data-signature="recurring">Recurring: /);
});
test('a stall escalates only when the timeout signature repeats across STALL_REPEAT suites (asked by Verse)', async () => {
  const { autopsy, autopsyHtml, STALL_REPEAT } = await import('../void-live-deploy/lib/autopsy.js');
  const fam = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'clock' }] }] };
  const red = (n) => ({ incidents: Array.from({ length: n }, (_, k) => ({ at: '2026-10-1' + k + 'T09:00:00Z', sha: 'abcdef' + k + '000', suite: 's', checks: ['check timeout: no check finished within 300 s'] })) });
  assert.equal(STALL_REPEAT, 3);
  const two = autopsy(red(2), fam, { pages: [] }), three = autopsy(red(3), fam, { pages: [] });
  assert.equal(two.suite.stalled, 2); assert.equal(two.suite.escalated, false); assert.equal(three.suite.escalated, true);
  assert.match(autopsyHtml(two), /data-stall-escalated="0">Not escalated: 2 of the 3/); assert.match(autopsyHtml(three), /data-stall-escalated="1">Escalated:<\/b> the stall repeats across 3 suites/);
  assert.equal(autopsy({ incidents: [{ at: '2026-10-17T09:00:00Z', sha: 'aaaaaaa1', suite: 's', checks: ['clock: "set it" fails'] }] }, fam, { pages: [] }).suite.escalated, false);
});

test('remediation draft and builder brief: re-run the failing checks alone, open the likely file, undo it if it still fails (asked by Verse)', async () => {
  const A = await import('../void-live-deploy/lib/autopsy.js');
  const i = { sha: 'abcdef1234567', at: '2026-10-21T09:00:00Z', suite: 's', checks: [{ text: 'clock: what time', skill: 'clock', family: 'time' }, { text: 'check timeout: x', meta: true }], suspects: [{ file: 'void-live-deploy/skills/clock.js', skill: 'clock', likely: true }], touched: ['void-live-deploy/skills/clock.js'] };
  const r = A.remediationOf(i);
  assert.ok(r[0].includes('test_void.mjs --only "clock"') && r[1].includes('skills/clock.js') && r[2].includes('git checkout abcdef12~1 -- void-live-deploy/skills/clock.js') && r[3].endsWith('/commit/abcdef1234567'), r.join('\n'));
  assert.ok(A.builderBrief(i).includes('Remediation draft:') && A.builderBrief(i).includes('(the suite itself)'));
  const h = A.remedyHtml(i, (s) => String(s).replace(/[&<>"]/g, ''));
  assert.ok(h.includes('data-builder-brief=') && h.includes('issues/new?labels=builder'));
});
