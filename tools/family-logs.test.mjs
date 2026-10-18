import test from 'node:test';
import assert from 'node:assert/strict';
import { familyLogs, familyLogsHtml, suite } from '../void-live-deploy/skills/growth.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

test('each family with failing skills gets a failure log: the bench asks it got wrong and a tap-to-copy chip', () => {
  const fam = { families: [
    { name: 'Strong', skills: [{ name: 'a', tier: 'proven' }] },
    { name: 'Words and the world', skills: [{ name: 'define', tier: 'tested', failing: ['define "<b>x</b>"', 'meaning of y'] }, { name: 'quote', tier: 'tested', smoke: ['examples miss'] }, { name: 'fine', tier: 'proven' }] },
    { name: 'Making things', skills: [{ name: 'forge', tier: 'proven', failing: ['one'] }] },
  ] };
  const L = familyLogs(fam);
  assert.deepEqual(L.map((l) => l.family), ['Words and the world', 'Making things']);
  assert.deepEqual(L[0].skills.map((s) => s.name), ['define', 'quote']);
  assert.equal(L[0].skills[0].chip, 'tell me about the define skill');
  assert.equal(L[0].skills[1].asks.length, 0);
  const h = familyLogsHtml(esc, L);
  assert.ok(h.includes('data-family-log="Words and the world"') && h.includes('data-copy="tell me about the define skill"') && h.includes('&lt;b&gt;x&lt;/b&gt;') && !h.includes('<b>x'));
  assert.ok(h.includes('the smoke test found examples miss'));
});

test('nothing failing, nothing listed; long families are cut with a count; bad input is safe', () => {
  assert.deepEqual(familyLogs({ families: [{ name: 'F', skills: [{ name: 'ok', tier: 'proven' }] }] }), []);
  assert.equal(familyLogsHtml(esc, []), '');
  assert.deepEqual(familyLogs(null), []);
  const many = { families: [{ name: 'F', skills: Array.from({ length: 7 }, (_, i) => ({ name: 's' + i, failing: ['q'] })) }] };
  assert.equal(familyLogs(many)[0].skills.length, 5);
  assert.equal(familyLogs(many)[0].more, 2);
  assert.ok(familyLogsHtml(esc, familyLogs(many)).includes('and 2 more'));
});

test('the growth skill suite still passes with the logs in it', () => {
  assert.equal(suite().ok, true);
});
