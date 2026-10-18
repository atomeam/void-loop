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
test('a test case from each recent failure (asked by Void): the ask the check quotes, else the skill\'s own example; newest first, one per skill, unmapped checks skipped', async () => {
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

test('stability gauge: red suites in the last week lower the score; none is steady (asked by Void)', async () => {
  const { stabilityOf, stabilityHtml } = await import('../void-live-deploy/lib/autopsy.js');
  const now = Date.parse('2026-10-18T12:00:00Z'), mk = (...ats) => ({ incidents: ats.map((at, n) => ({ at, sha: 'abcdef' + n, checks: ['x'] })) });
  assert.deepEqual(stabilityOf(mk('2026-09-01T00:00:00Z'), now), { score: 100, label: 'steady', week: 0, day: 0, known: 1 });
  const g = stabilityOf(mk('2026-10-18T06:00:00Z', '2026-10-15T00:00:00Z', '2026-10-01T00:00:00Z'), now); assert.deepEqual([g.score, g.label, g.week, g.day], [76, 'wobbly', 2, 1]);
  assert.equal(stabilityOf(mk(...Array(9).fill('2026-10-17T00:00:00Z')), now).score, 0); assert.equal(stabilityOf(mk(...Array(9).fill('2026-10-17T00:00:00Z')), now).label, 'shaky');
  assert.equal(stabilityOf(mk('2027-01-01T00:00:00Z'), now).week, 0, 'a time in the future is not counted');
  assert.match(stabilityHtml(g), /data-stability="wobbly"/); assert.match(stabilityHtml(stabilityOf(null, now)), /data-stability="none"/); assert.match(stabilityHtml(g), /width:76%/);
});
test('culprit pointer: a changed skill file whose skill has a failing check is the likely cause; none changed says so (asked by Void)', () => {
  assert.equal(skillOfPath('void-live-deploy/skills/convert.js'), 'convert'); assert.equal(skillOfPath('void-live-deploy/skills/order/0480-watch'), null); assert.equal(skillOfPath('tools/convert.js'), null);
  const sus = suspectsOf(['tools/x.mjs', 'void-live-deploy/skills/clock.js', 'void-live-deploy/skills/convert.js'], [{ skill: 'convert' }, { skill: null }]);
  assert.deepEqual(sus.map((s) => [s.skill, s.likely]), [['convert', true], ['clock', false]]);
  const inc = (touched) => ({ incidents: [{ at: '2026-10-17T09:51:08Z', sha: '95164ec9caef', suite: 's', checks: ['convert card: maths'], touched }] });
  let h = autopsyHtml(autopsy(inc(['void-live-deploy/skills/convert.js', 'a<b.js']), FAM, GUIDE));
  assert.match(h, /data-culprit="likely"/); assert.match(h, /Likely cause: <code>skills\/convert\.js<\/code> \(has a failing check\)/); assert.ok(!h.includes('a<b'));
  h = autopsyHtml(autopsy(inc(['domains/x.md']), FAM, GUIDE)); assert.match(h, /data-culprit="none"/); assert.match(h, /No skill file changed/);
  h = autopsyHtml(autopsy(inc(undefined), FAM, GUIDE)); assert.ok(!h.includes('data-culprit'), 'paths never recorded say nothing');
});
