// Relevance gate for the "From A-to-Mind: …" product line (lib/gumroad.js productFor + void.html attachProductTail).
// A loose match used to append Verse Code Review Pro under an unrelated fallback-stack answer; this keeps the line
// only when the ask clearly matches a product (code review, automation, board, tip jar) and never on self/meta.
import assert from 'node:assert/strict';
import { productFor, publicProduct } from '../void-live-deploy/lib/gumroad.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = [
  { slug: 'yinmj', id: 'ITp6zMMOC7A2h-bsSejYSA==', name: 'Verse Monthly', description: 'Paid membership.', price_cents: 4900, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/yinmj', available: true },
  { slug: 'join-the-team', name: 'Join the Team', description: 'A dollar to back the crew.', price_cents: 100, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/join-the-team', available: true },
  { slug: 'gqsgib', name: 'The Big Board', description: 'Real Jobs that pay real money.', price_cents: 2500, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/gqsgib', available: true },
  { slug: 'first-automation-setup', name: 'First Automation Setup', description: 'If you do anything twice a week by hand, it can probably run itself.', price_cents: 10000, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/first-automation-setup', available: true },
  { slug: 'full-stack-audit', name: 'Full Stack Audit', description: 'Most businesses are running automations nobody fully remembers building.', price_cents: 30000, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/full-stack-audit', available: true },
  { slug: 'keep-it-running-membership', name: 'Keep-It-Running Plan', description: 'Your automations run your day until one quietly stops.', price_cents: 4900, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/keep-it-running-membership', available: true },
  { slug: 'eozcma', name: 'Automation Cleanup', description: 'Got a Zap that broke and you don\'t have time to figure out why? Send it to me and I\'ll fix it — fast.', price_cents: 2500, currency: 'usd', url: 'https://moonbeam846.gumroad.com/l/eozcma', available: true },
  { slug: 'void-code-review', name: 'Verse Code Review Pro', description: 'Verse Code Review Pro — an AI reviewer on every pull request. The free Verse review already checks each PR.', price_cents: 1000, currency: 'usd', recurrence: 'monthly', url: 'https://moonbeam846.gumroad.com/l/void-code-review', available: true },
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
  // long pasted prose (paraphrased from a real paste, 2026-10-15): incidental "tests", "hack", "check", even an echoed sponsor line
  'I am adding this to the core values and saving it. From now on, when the assistant declines a harmful or unkind request it will not just say no, it will steer toward something good. For example, a request to hack an ex partner\'s account becomes help securing your own accounts, and an insult gets a kind, funny reply. I am also adding tests to check that it refuses the harmful part and offers a positive alternative.',
  'I am adding this to the core values and saving it. When the assistant declines a harmful request it steers toward something good, and tests check it. written by Verse, from what it knows copy From A-to-Mind: Verse Code Review Pro · $10 a month · moonbeam846.gumroad.com/l/void-code-review',
  'Here is the plan for this week. We will write more tests, review the onboarding copy, and harden the login against anyone trying to hack accounts. The code freeze is Friday and the pull request queue should be empty by then, so please check everything twice.',
  'The site tester types real questions into the page, checks that answers and cards load, reviews screenshots and frame rate, and files one fix per distinct bug. It never posts or signs up, and every test run must end in an improvement such as a harder test or a code change.',
  'Long story: my friend got hacked last week, so I spent the weekend reading about passwords, two-factor codes and recovery keys, and I tested a few password managers. Which one would you recommend for a family?',
];
for (const ask of no) assert.equal(productFor(ask, catalog), null, 'no line for: ' + ask.slice(0, 60));

// a long paste that opens with a real review request still gets the line
assert.equal(productFor('review my code\nfunction add(a, b) { return a - b; } // tests say this should add, but the review found it subtracts, please check the pull request too', catalog)?.slug, 'void-code-review');
// the code-review trigger judges long prose by its opening sentence
const cr = await import('../void-live-deploy/lib/code-review.js');
assert.equal(cr.isReviewAsk(no[14]), false);
assert.equal(cr.isReviewAsk('So I spent the whole afternoon writing up the plan for the launch and the tests and the docs and the board, and honestly it went well. Anyway, is my code ok? I think there are bugs in the plan.'), false);
assert.equal(cr.isReviewAsk('review my code'), true);
assert.equal(cr.isReviewAsk('what is wrong with my function?'), true);

// fix mode: a broken-automation ask may still get Automation Cleanup after the fix
assert.equal(productFor('can you fix my zapier zap, it double sends', catalog, { fix: true })?.slug, 'eozcma');
assert.equal(productFor('my zapier zap double sends, every order shows up twice', catalog, { fix: true })?.slug, 'eozcma');

// meta flag: never a line
assert.equal(productFor('review my code', catalog, { meta: true }), null);

// page: attachProductTail skips self/menu/identity before it scores
const html = readFileSync(resolve(here, '../void.html'), 'utf8');
assert.match(html, /wantsSelfPage\(lower\) \|\| wantsIdentity\(lower\) \|\| wantsMenu\(lower\)/);
assert.match(html, /productFor\(text, products, \{ fix: !!opt\.fix, meta: !!opt\.meta \}\)/);

// review path: "review my code" used to return from handleReviewAsk without a product line
assert.match(html, /attachProductTail\(text, \{ el \}\); \/\/ Code Review Pro/);
assert.match(html, /attachProductTail\(ask \|\| title, \{ el \}\)/);


console.log('product-tail: ok (clear matches, no fallback-stack false positives, fix mode, meta skip, page gate)');
