// V01D's own component names route to the component, and ordinal dates read as numbers (owner, 2026-10-18).
import test from 'node:test'; import assert from 'node:assert/strict';
import { partOf, PARTS } from '../void-live-deploy/lib/own-parts.js';
import ownParts from '../void-live-deploy/skills/own-parts.js';
import { countdownOf, plainDate } from '../void-live-deploy/skills/countdown.js';

const WANT = {
  'Show me the Site Test card': 'site-test', 'the site test card': 'site-test', 'show me the site test': 'site-test', 'open the site test': 'site-test',
  'my site test card': 'site-test', 'pull up the site test card': 'site-test', 'where is the site test card?': 'site-test', 'show me the stability trend': 'site-test',
  'the status card': 'status', 'open the status page': 'status', 'pull up the growth inbox': 'growth', 'the growth card': 'growth', 'show me the tome': 'book',
  'where is the book': 'book', 'the book chapter': 'book', 'show me the rule registry': 'rule-registry', 'open the rule registry view': 'rule-registry', 'the merges page': 'merges',
};
test('an ask that names a part of V01D with the frame or a card word finds that part', () => {
  for (const [ask, id] of Object.entries(WANT)) assert.equal((partOf(ask) || {}).id, id, ask);
});
test('look-alikes about other things are left alone', () => {
  for (const ask of ['show me a visa test card', 'test card numbers for stripe', 'what is the status of my order', 'the book thief', 'open a book about dogs', 'show me the weather card', 'status quo', 'inbox zero tips', 'site test results for my website speed'])
    assert.equal(partOf(ask), null, ask);
});
test('every part names a skill that exists in the skill, and its own ask is what that skill answers', () => {
  const ok = new Set(['growth', 'guide', 'status', 'merges']);
  for (const p of PARTS) assert.ok(ok.has(p.skill), p.id);
});
test('the skill takes only what the target skill does not already take, and names the target', () => {
  assert.equal(ownParts.match('show me the site test card', 'Show me the Site Test card'), true);
  assert.equal(ownParts.part('show me the site test card', 'Show me the Site Test card'), 'growth');
  assert.equal(ownParts.match('open the book', 'open the book'), false); // the book's own ask stays the book's
  assert.equal(ownParts.match('site test', 'site test'), false);
});
test('ordinal dates count down like plain ones', () => {
  assert.equal(plainDate('days until the 1st of march'), 'days until march 1');
  assert.equal(plainDate('days till jan 2nd'), 'days till january 2');
  const one = (a) => { const c = countdownOf(a); return c && c.label; };
  assert.deepEqual(countdownOf('how many days until january 1st'), countdownOf('how many days until january 1'));
  assert.equal(one('days until the 1st of march'), 'march 1');
  assert.equal(one('how many days till jan 2nd'), 'january 2');
  assert.equal(one('days until dec 25th'), 'december 25');
  assert.equal(countdownOf('days until february 31st'), null);
});
