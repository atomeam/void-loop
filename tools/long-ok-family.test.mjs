// Long prose reaches a family's member made for it (lib/ask-text.js longOk, lists run 18). The page lets long prose through only to the
// skills in LONG_OK; it read the routing entry's name, so once proposal joined the proposals family and translate the languages family,
// a pasted customer request ("turn this into a proposal: ...") and a long text to translate fell through to other skills (the browser
// suite's proposal card check timed out on main from 2026-11-11). Run: node --test tools/long-ok-family.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { longOk, isLongProse, LONG_OK } from '../void-live-deploy/lib/ask-text.js';
import proposals from '../void-live-deploy/skills/proposals.js';
import languages from '../void-live-deploy/skills/languages.js';

const REQ = 'turn this into a proposal: Hi, ⏎ We run a small bakery and our online orders come in through Shopify. We need the zap that copies each order into our sheet fixed: every order shows up twice. ⏎ Can you tell us what you would do and when you could start? ⏎ maria@bakery.example';

test('a family passes long prose when the member that answers is made for it', () => {
  assert.ok(isLongProse(REQ.replace(/^turn this into a proposal: /, '')));
  assert.equal(proposals.part(REQ.toLowerCase(), REQ), 'proposal');
  assert.ok(longOk(proposals, REQ.toLowerCase(), REQ), 'proposal takes the pasted request inside its family');
  assert.ok(LONG_OK.has('translate'));
  const tr = 'translate to spanish: ' + 'We met on Monday to talk about the plan for the spring. The plan changed twice, and the team agreed to ship the first part next week. '.repeat(2);
  const m = languages.member(tr.toLowerCase(), tr);
  if (m && m.name === 'translate') assert.ok(longOk(languages, tr.toLowerCase(), tr));
});
test('a skill not made for long text still does not take it, family or not', () => {
  assert.equal(longOk({ name: 'weather', match: () => true }, 'x', 'x'), false);
  assert.equal(longOk({ name: 'fam', member: () => ({ name: 'weather' }) }, 'x', 'x'), false);
  assert.equal(longOk({ name: 'fam', member: () => { throw new Error('x'); } }, 'x', 'x'), false);
  assert.equal(longOk(null, 'x', 'x'), false);
});
test('the page and its two deploy copies ask longOk, not the entry name alone', () => {
  for (const p of ['void.html', 'void-live-deploy/void.html', 'void-live-deploy/index.html']) {
    const s = readFileSync(new URL('../' + p, import.meta.url), 'utf8');
    assert.ok(s.includes('askText.longOk(sk, lower0, text)'), p);
    assert.ok(!s.includes('askText.LONG_OK.has(sk.name)'), p);
  }
});
