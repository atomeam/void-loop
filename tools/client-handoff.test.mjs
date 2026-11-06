// client-handoff: a shareable card that names what Verse already owns. node --test tools/client-handoff.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { isClientHandoff, subjectOf, packageOf, cardHtml } from '../void-live-deploy/skills/client-handoff.js';
import { isDeliveryPack } from '../void-live-deploy/skills/delivery-pack.js';
import { isSystemHandoff } from '../void-live-deploy/skills/system-handoff.js';

const ASK = 'client handoff for the onboarding automation';

test('a client handoff names the system and leaves delivery-pack and system-handoff asks alone', () => {
  for (const a of skill.examples) assert.equal(isClientHandoff(a), true, a);
  for (const a of skill.nearMisses) assert.equal(isClientHandoff(a), false, a);
  assert.equal(isClientHandoff(ASK), true);
  assert.equal(isClientHandoff('make a client handoff for the invoice flow'), true);
  assert.equal(subjectOf(ASK), 'onboarding automation');
  assert.equal(subjectOf('client handoff'), 'the system');
  assert.equal(isDeliveryPack('handoff pack for my SaaS idea'), true);
  assert.equal(isClientHandoff('handoff pack for my SaaS idea'), false);
  assert.equal(isClientHandoff('delivery package: invoice reminders'), false);
  assert.equal(isClientHandoff('system handoff for the invoice flow'), false);
  assert.equal(isSystemHandoff('system handoff for the invoice flow'), true);
  assert.equal(skill.match(ASK.toLowerCase(), ASK), true);
});

test('the card lists what Verse owns and covers status, docs, and monitors, and invents no green status', () => {
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
  assert.match(html, /No status is invented here/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /class="share"/);
  assert.doesNotMatch(html, /Last check: green/);
});

test('run paints that card and returns the skill name', () => {
  let html = '';
  const ret = skill.run(ASK, {
    esc: (s) => String(s),
    showPage: (fn) => { const el = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } }; fn(el); return el; },
  });
  assert.equal(ret, 'client-handoff');
  assert.match(html, /Client handoff: onboarding automation/);
  assert.match(html, /business-clarify/);
  assert.match(html, /No status is invented here/);
});
