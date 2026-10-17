// "Suggest fix" on the correction log: owner only, redacted, existing route (lib/correction-fix.js). node --test tools/correction-fix.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { ownerOnly, fixRequest, sentWords, resultHtml, suggestFix, FIX_ROUTE } from '../void-live-deploy/lib/correction-fix.js';
import { logHtml } from '../void-live-deploy/lib/corrections.js';
const FAM = { families: [{ id: 'time', name: 'Time', skills: [{ name: 'clock' }] }] };
const KEY = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0'; // secret-scan: ok: made-up key to test redaction
const entry = { skill: 'clock', ask: 'set the clock with ' + KEY + ' now', text: 'my private words about my mum: SECRETWORDS', at: 'x' };

test('the button is drawn for the owner only', () => {
  const list = [entry, { skill: '', ask: 'x ask', text: 'no skill' }];
  assert.match(logHtml(list, FAM, String, { owner: true }), /data-suggest-fix="0"/);
  assert.ok(!/data-suggest-fix="1"/.test(logHtml(list, FAM, String, { owner: true })), 'no skill, no button');
  for (const o of [{}, { owner: false }, undefined]) assert.ok(!/suggest-fix|Suggest fix/.test(logHtml(list, FAM, String, o)));
  assert.deepEqual(['', '  ', null, undefined, 5].map(ownerOnly), [false, false, false, false, false]); assert.equal(ownerOnly('k'), true);
});
test('only the skill, the family and the redacted ask leave; never the visitor\'s words', () => {
  const req = fixRequest(entry, FAM, '// the clock skill file '.repeat(5));
  assert.equal(req.skill, 'clock'); assert.equal(req.mode, 'narrow'); assert.match(req.said, /family: time/);
  assert.ok(!JSON.stringify(req).includes(KEY), 'the key is masked'); assert.match(req.ask, /\[redacted\]/);
  assert.ok(!JSON.stringify(req).includes('SECRETWORDS') && !JSON.stringify(req).includes('mum'), 'the correction text is not sent');
  assert.deepEqual(Object.keys(req).sort(), ['ask', 'mode', 'said', 'skill', 'source']);
  assert.equal(fixRequest({ skill: '../etc', ask: 'abcd' }, FAM, 's'), null); assert.equal(fixRequest({ skill: 'clock', ask: 'a' }, FAM, 's'), null); assert.equal(fixRequest(null, FAM, 's'), null);
  assert.match(sentWords(req), /Your own words were not sent/); assert.ok(!sentWords(req).includes(KEY));
});
test('without the owner key nothing is fetched; with it the existing route is called once with the key', async () => {
  let calls = [];
  const fetchFn = async (url, init) => { calls.push([url, init]); return url.startsWith('/skills/') ? { ok: true, text: async () => '// skill file '.repeat(10) } : { ok: true, json: async () => ({ edits: [{ find: 'a <b>', replace: 'c' }], why: 'it <i>did</i> not match', confidence: 0.8 }) }; };
  const no = await suggestFix(entry, FAM, { owner: '', fetchFn }); assert.equal(no.got.ok, false); assert.equal(calls.length, 0);
  const yes = await suggestFix(entry, FAM, { owner: 'owner-key', fetchFn }); // secret-scan: ok: made-up
  assert.equal(calls.length, 2); assert.equal(calls[1][0], FIX_ROUTE); assert.equal(calls[1][1].headers.authorization, 'Bearer owner-key');
  assert.ok(!calls[1][1].body.includes('SECRETWORDS') && !calls[1][1].body.includes(KEY));
  const html = resultHtml(yes.sent, yes.got); assert.match(html, /1 line change, sure to 80%/); assert.ok(!html.includes('<b>') && !html.includes('<i>'), 'escaped'); assert.match(html, /nothing was changed/);
});
test('failures say why and never throw', async () => {
  const gone = await suggestFix(entry, FAM, { owner: 'k', fetchFn: async () => ({ ok: false, status: 404 }) }); assert.match(gone.got.error, /no file of its own/);
  const denied = await suggestFix(entry, FAM, { owner: 'k', fetchFn: async (u) => (u.startsWith('/skills/') ? { ok: true, text: async () => 'x'.repeat(60) } : { ok: false, status: 401, text: async () => 'no' }) }); assert.match(denied.got.error, /not accepted/);
  const boom = await suggestFix(entry, FAM, { owner: 'k', fetchFn: async () => { throw new Error('x'); } }); assert.equal(boom.got.ok, false);
  assert.match(resultHtml('', denied.got), /No proposal: the owner key/); assert.match(resultHtml('', null), /did not answer/);
});
