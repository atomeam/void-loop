// client-handoff: a shareable card that names what Verse already owns. node --test tools/client-handoff.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isClientHandoff, subjectOf, packageOf, cardHtml } from '../void-live-deploy/skills/client-handoff.js';
import { isDeliveryPack } from '../void-live-deploy/skills/delivery-pack.js';

const ASK = 'client handoff for the onboarding automation';

test('a client handoff is this skill, and a delivery pack stays a delivery pack', () => {
  for (const a of skill.examples) assert.equal(isClientHandoff(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isClientHandoff(a), false, a);
  assert.equal(isDeliveryPack('handoff pack for my SaaS idea'), true);
  assert.equal(isClientHandoff('handoff pack for my SaaS idea'), false);
  assert.equal(isDeliveryPack(ASK), false, 'delivery-pack does not take a client handoff');
  assert.equal(skill.match(ASK.toLowerCase(), ASK), true);
  assert.equal(subjectOf(ASK), 'onboarding automation');
  assert.equal(subjectOf('client handoff'), 'the system');
});

test('the card lists what Verse owns and covers status, docs, and monitors', () => {
  const p = packageOf(ASK);
  assert.equal(p.subject, 'onboarding automation');
  assert.deepEqual(p.covers, ['status', 'docs', 'monitors']);
  assert.ok(p.owns.some((x) => /business-clarify/.test(x)));
  assert.ok(p.owns.some((x) => /system-status/.test(x)));
  assert.ok(p.owns.some((x) => /confirm line/.test(x)));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = cardHtml(esc, 'client handoff for <script>');
  assert.match(html, /business-clarify/);
  assert.match(html, /system-status/);
  assert.match(html, /confirm line/);
  assert.match(html, /Status:/);
  assert.match(html, /Docs:/);
  assert.match(html, /Monitors:/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  const own = cardHtml(null, 'client handoff for <script>');
  assert.match(own, /&lt;script&gt;/);
  assert.match(html, /class="share"/);
  assert.match(html, /Nothing is sent from this card/);
});

test('run paints that card and returns the skill name', async () => {
  let html = '';
  const el = { set innerHTML(v) { html = v; } };
  const ret = await skill.run(ASK, {
    esc: (s) => String(s),
    showPage: (fn) => { fn(el); return el; },
  });
  assert.equal(ret, 'client-handoff');
  assert.match(html, /Client handoff: onboarding automation/);
  assert.match(html, /business-clarify/);
  assert.match(html, /system-status/);
  assert.match(html, /confirm line/);
});
