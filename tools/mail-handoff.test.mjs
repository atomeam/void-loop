// The mail hand-off on the food & rides card (skills/rides.js + skills/providers.js, asked by Verse ask-20261028-1856-1, lists run 7):
// "my email" opens your inbox in your own mail app; "email sam that ..." fills a draft you send yourself. Run: node --test tools/mail-handoff.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import rides, { mailAsk, mailDraft, ridesAsk } from '../void-live-deploy/skills/rides.js';
import { ofKind, mailto } from '../void-live-deploy/skills/providers.js';

test('direct mail commands open the mail card', () => {
  for (const a of ['my email', 'check my email', 'open my inbox', 'open gmail', 'check outlook', 'do i have new emails']) assert.deepEqual(mailAsk(a), { mail: true }, a);
  assert.deepEqual(mailAsk('email sam that I am running late'), { mail: true, to: 'sam', body: 'I am running late' });
  assert.deepEqual(mailAsk('send an email to jo@example.com'), { mail: true, to: 'jo@example.com' });
});
test('asks about email in general stay with the skills that answer them', () => {
  for (const a of ['what is email', 'how do i write a good email', 'email marketing tips', 'digest my email', 'what is my email address', 'email me that']) assert.equal(mailAsk(a), null, a);
  for (const a of rides.nearMisses) assert.equal(rides.match(a.toLowerCase(), a), false, a);
  assert.ok(ridesAsk('get me a ride to the airport'), 'rides still answer');
});
test('the draft is filled in and every link opens the person\'s own mail app', () => {
  const d = mailDraft({ to: 'sam', body: 'i am running late' });
  assert.equal(d.to, ''); assert.equal(d.name, 'Sam'); assert.equal(d.subject, 'I am running late'); assert.equal(d.body, 'Hi Sam,\n\nI am running late.');
  assert.equal(mailDraft({ to: 'jo@example.com' }).to, 'jo@example.com');
  assert.equal(mailto({ to: 'jo@example.com', subject: 'Hi', body: 'a b' }), 'mailto:jo@example.com?subject=Hi&body=a%20b');
  const mail = ofKind('mail'); assert.ok(mail.length >= 5);
  for (const p of mail) { assert.match(p.web({}), /^https:\/\//); assert.equal(p.order, null); }
  assert.match(ofKind('mail').find((p) => p.id === 'gmail').web({ to: 'jo@example.com', subject: 's', body: 'b' }), /^https:\/\/mail\.google\.com\/mail\/\?view=cm/);
});
