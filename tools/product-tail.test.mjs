// Relevance gate for the "From A-to-Mind: …" product line (lib/gumroad.js productFor + void.html attachProductTail).
// A loose match used to append Void Code Review Pro under an unrelated fallback-stack answer; this keeps the line
// only when the ask clearly matches a product (code review, automation, board, tip jar) and never on self/meta.
import assert from 'node:assert/strict';
import { productFor, publicProduct } from '../void-live-deploy/lib/gumroad.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = [
  { slug: 'yinmj', id: 'ITp6zMMOC7A2h-bsSejYSA==', name: 'Void Monthly', description: 'Paid membership.', price_cents: 4900, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/yinmj', available: true },
  { slug: 'join-the-team', name: 'Join the Team', description: 'A dollar to back the crew.', price_cents: 100, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/join-the-team', available: true },
  { slug: 'gqsgib', name: 'The Big Board', description: 'Real Jobs that pay real money.', price_cents: 2500, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/gqsgib', available: true },
  { slug: 'first-automation-setup', name: 'First Automation Setup', description: 'If you do anything twice a week by hand, it can probably run itself.', price_cents: 10000, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/first-automation-setup', available: true },
  { slug: 'full-stack-audit', name: 'Full Stack Audit', description: 'Most businesses are running automations nobody fully remembers building.', price_cents: 30000, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/full-stack-audit', available: true },
  { slug: 'keep-it-running-membership', name: 'Keep-It-Running Plan', description: 'Your automations run your day until one quietly stops.', price_cents: 4900, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/keep-it-running-membership', available: true },
  { slug: 'eozcma', name: 'Automation Cleanup', description: 'Got a Zap that broke and you don\'t have time to figure out why? Send it to me and I\'ll fix it — fast.', price_cents: 2500, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/eozcma', available: true },
  { slug: 'void-code-review', name: 'Void Code Review Pro', description: 'Void Code Review Pro — an AI reviewer on every pull request. The free Void review already checks each PR.', price_cents: 1000, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/void-code-review', available: true },
].map(publicProduct);

const yes = [
  ['review my code', 'void-code-review'],
  ['code review my pull request', 'void-code-review'],
  ['can you do a code review', 'void-code-review'],
  ['can you audit my automations?', 'full-stack-audit'],
  ['help me set up my first automation', 'first-automation-setup'],
  ['tell me about the big board', 'gqsgib'],
  ['how do I join the team', 'join-the-team'],
  ['keep my automations running', 'keep-it-running-membership'],
  ['full stack audit please', 'full-stack-audit'],
];
for (const [ask, slug] of yes) {
  const p = productFor(ask, catalog);
  assert.equal(p && p.slug, slug, ask + ' -> ' + (p && p.slug));
}

const no = [
  'The fallback stack won’t just be a backup for chat. Each new ability gets its own spot that free providers can fill: seeing and understanding images, making images, speech in and out, semantic search, running code, web search, translation, reading text from pictures',
  'the fallback stack which is another product',
  'what is a fallback stack',
  'explain the infinite fallback stack',
  'what is a black hole',
  'why is the sky blue',
  'what are you',
  'who are you',
  'what can you do',
  'tip',
  'buy',
  '3d miniatures',
  'printable minis',
  'chess set download',
];
for (const ask of no) assert.equal(productFor(ask, catalog), null, 'no line for: ' + ask.slice(0, 60));

// fix mode: a broken-automation ask may still get Automation Cleanup after the fix
assert.equal(productFor('can you fix my zapier zap, it double sends', catalog, { fix: true })?.slug, 'eozcma');
assert.equal(productFor('my zapier zap double sends, every order shows up twice', catalog, { fix: true })?.slug, 'eozcma');

// meta flag: never a line
assert.equal(productFor('review my code', catalog, { meta: true }), null);

// page: attachProductTail skips self/menu/identity before it scores
const html = readFileSync(resolve(here, '../void.html'), 'utf8');
assert.match(html, /wantsSelfPage\(lower\) \|\| wantsIdentity\(lower\) \|\| wantsMenu\(lower\)/);
assert.match(html, /productFor\(text, products, \{ fix: !!opt\.fix, meta: !!opt\.meta \}\)/);

console.log('product-tail: ok (clear matches, no fallback-stack false positives, fix mode, meta skip, page gate)');
