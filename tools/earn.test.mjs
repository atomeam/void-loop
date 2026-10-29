// Verse's earn loop (tools/earn.mjs, tools/earn-core.mjs, .github/workflows/earn-self.yml): every decision it makes, pinned. Run: node --test tools/earn.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlText, linksOf, headingsOf, looksLikeError, discover, slugOf, rank, covered, errorOnPage, excerptOf, checkDraft, pageRow, appraiseService, toRetire, learnWeights, selfLine } from './earn-core.mjs';
import { totals, offerOf, parsePing } from '../void-live-deploy/lib/earnings.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');

test('Verse earns without Claude: the loop, its core and its workflow never name anthropic or claude', () => {
  for (const f of ['tools/earn.mjs', 'tools/earn-core.mjs', '.github/workflows/earn-self.yml']) {
    const s = readFileSync(resolve(root, f), 'utf8');
    assert.ok(!/anthropic|claude/i.test(s), f + ' names anthropic or claude: the earn loop runs on Verse\'s own free model only');
  }
});

test('page text and links: markup out, entities and quotes made plain, links absolute and on https only', () => {
  assert.equal(htmlText('<nav>menu</nav><h1>Error&nbsp;522</h1><script>x()</script><p>Connection timed out &ldquo;now&rdquo;</p>'), 'Error 522 Connection timed out "now"');
  assert.deepEqual(linksOf('<a href="/docs/errors/A_B#x">a</a><a href="http://x.com/">b</a><a href="#top">c</a>', 'https://vercel.com/docs/errors'), ['https://vercel.com/docs/errors/A_B', 'https://vercel.com/docs/errors']);
  assert.deepEqual(headingsOf('<h2 id="e1">Error: The service refused the connection</h2><h3>Overview</h3>'), [{ text: 'Error: The service refused the connection', id: 'e1' }, { text: 'Overview', id: '' }]);
  assert.ok(looksLikeError('The service refused the connection') && looksLikeError('FUNCTION_INVOCATION_TIMEOUT') && !looksLikeError('Overview') && !looksLikeError('Next steps'));
  assert.ok(looksLikeError('ConnectionError') && looksLikeError('Bad request - please check your parameters') && looksLikeError('Error 522'));
  for (const section of ['Billing errors', 'Common issues', 'Troubleshooting failed runs', 'How to fix a timeout', 'Types of errors', 'Handling errors']) assert.ok(!looksLikeError(section), section);
});

test('find: a list of official pages whose headings are errors; codes from a lowercase link are written as the docs show them', () => {
  const make = { platform: 'Make', kind: 'headings', hosts: ['help.make.com'], pages: ['https://help.make.com/common-errors', 'https://help.make.com/missing'], heading: '^(?:Error:\\s*)?(.{6,140})$' };
  const got = discover(make, { 'https://help.make.com/common-errors': '<h2 id="c">ConnectionError</h2><h2>Common errors</h2><h3 id="i">Error: Invalid access token</h3>' });
  assert.deepEqual(got.map((c) => [c.error, c.doc]), [['ConnectionError', 'https://help.make.com/common-errors#c'], ['Invalid access token', 'https://help.make.com/common-errors#i']]);
  const v = { platform: 'Vercel', kind: 'code', index: 'https://vercel.com/docs/errors', hosts: ['vercel.com'], link: '^https://vercel\\.com/docs/errors/([A-Za-z][A-Za-z0-9_]{3,63})/?$', upper: true, doc: 'https://vercel.com/docs/errors/$1' };
  assert.deepEqual(discover(v, { [v.index]: '<a href="/docs/errors/function_invocation_timeout">x</a>' }), [{ platform: 'Vercel', error: 'FUNCTION_INVOCATION_TIMEOUT', doc: 'https://vercel.com/docs/errors/function_invocation_timeout' }]);
});

test('never twice: a candidate a page already covers (one of its " · " variants, 60% of the words, or one inside the other) is left out', () => {
  const pages = JSON.parse(readFileSync(resolve(root, 'tools/fix-pages.json'), 'utf8'));
  assert.equal(covered({ platform: 'n8n', error: 'The service refused the connection' }, pages), 'n8n-econnrefused-http-request');
  assert.equal(covered({ platform: 'n8n', error: 'JSON parameter need to be an valid JSON' }, pages), 'n8n-json-parameter-needs-valid-json');
  assert.equal(covered({ platform: 'Make', error: 'RateLimitError' }, pages), 'make-rate-limit-error');
  assert.equal(covered({ platform: 'Make', error: 'ConnectionError' }, pages), 'make-connection-error');
  assert.equal(covered({ platform: 'Vercel', error: 'FUNCTION_INVOCATION_TIMEOUT' }, pages), '');
  assert.equal(covered({ platform: 'Zapier', error: 'Bad request - please check your parameters' }, pages), '');
  assert.deepEqual(rank([{ platform: 'Make', error: 'DataError' }, { platform: 'Make', error: 'InvalidConfigurationError' }], { pages }).map((c) => c.error), ['InvalidConfigurationError']);
});

test('find: an index of error codes gives one candidate per code; a headings page gives its error headings; other hosts never count', () => {
  const vercel = { platform: 'Vercel', kind: 'code', index: 'https://vercel.com/docs/errors', hosts: ['vercel.com'], link: '^https://vercel\\.com/docs/errors/([A-Z][A-Z0-9_]{3,63})/?$', doc: 'https://vercel.com/docs/errors/$1' };
  const idx = '<a href="/docs/errors/FUNCTION_INVOCATION_TIMEOUT">t</a><a href="/docs/errors/DEPLOYMENT_NOT_FOUND">d</a><a href="/docs/errors/FUNCTION_INVOCATION_TIMEOUT">again</a><a href="https://evil.example/docs/errors/X_Y_Z">x</a><a href="/docs/errors/error-list">list</a>';
  assert.deepEqual(discover(vercel, { [vercel.index]: idx }).map((c) => c.error), ['FUNCTION_INVOCATION_TIMEOUT', 'DEPLOYMENT_NOT_FOUND']);
  const n8n = { platform: 'n8n', kind: 'headings', index: 'https://docs.n8n.io/x/common-issues/', hosts: ['docs.n8n.io'], link: '^https://docs\\.n8n\\.io/y/common-issues/?$', self: true, heading: '^(?:Error:\\s*)?(.{8,120})$' };
  const page = '<h2 id="refused">Error: The service refused the connection</h2><h2>Overview</h2><a href="/y/common-issues/">more</a>';
  const more = '<h3 id="b">Bad request - please check your parameters</h3>';
  const got = discover(n8n, { [n8n.index]: page, 'https://docs.n8n.io/y/common-issues/': more });
  assert.deepEqual(got.map((c) => [c.error, c.doc]), [['The service refused the connection', 'https://docs.n8n.io/x/common-issues/#refused'], ['Bad request - please check your parameters', 'https://docs.n8n.io/y/common-issues/#b']]);
  assert.equal(slugOf('GitHub Actions', 'Error: "Resource not accessible"'), 'github-actions-error-resource-not-accessible');
});

test('rank: expected sales per effort, so the platform weight, an urgent error and Verse\'s own misses lift a candidate; built ones never come back', () => {
  const c = [{ platform: 'Vercel', error: 'DEPLOYMENT_NOT_FOUND' }, { platform: 'Make', error: 'RateLimitError' }, { platform: 'Vercel', error: 'Something 429 too many' }, { platform: 'n8n', error: 'old one' }];
  const r = rank(c, { weights: { Vercel: 0.7, Make: 0.9, n8n: 0.8 }, missTerms: [{ term: 'ratelimiterror', n: 0 }, { term: 'deployment', n: 15 }], built: new Set(['n8n-old-one']) });
  assert.deepEqual(r.map((x) => x.slug), ['vercel-deployment-not-found', 'vercel-something-429-too-many', 'make-ratelimiterror']);
  assert.match(r[0].why, /urgent/); assert.match(r[0].why, /15 of Verse's misses/);
});

test('the docs check: the error must be on the official page word for word (spacing and quote style aside, case kept)', () => {
  const doc = htmlText('<p>The function returned <code>FUNCTION_INVOCATION_TIMEOUT</code> after   the limit. It says &ldquo;Task timed out&rdquo;.</p>');
  assert.ok(errorOnPage('FUNCTION_INVOCATION_TIMEOUT', doc) && errorOnPage('says "Task timed out"', doc));
  assert.ok(!errorOnPage('FUNCTION_INVOCATION_TIMEOUTS_X', doc) && !errorOnPage('function_invocation_timeout', doc) && !errorOnPage('', doc));
  assert.ok(excerptOf(doc, 'FUNCTION_INVOCATION_TIMEOUT', 80).includes('FUNCTION_INVOCATION_TIMEOUT'));
});

const DOC = htmlText(`<h1>FUNCTION_INVOCATION_TIMEOUT</h1><p>This error occurs when a function exceeds its maximum duration.</p>
<p>Check that your database and API calls respond within the duration limit.</p><p>Make sure your function always returns a response, even an error.</p>
<p>Look for infinite loops in your code.</p><p>Review the logs of the deployment to find unhandled exceptions.</p>`);
const draft = (o = {}) => JSON.stringify({ means: 'The function ran longer than its plan allows and was stopped before it sent an answer, usually because a call it waits on is slow.',
  steps: [{ text: 'Check how long your database and API calls take and keep them inside the limit.', quote: 'Check that your database and API calls respond within the duration limit.' },
    { text: 'Make the function send a response on every path, errors included.', quote: 'Make sure your function always returns a response, even an error.' },
    { text: 'Look through the code for a loop that never ends.', quote: 'Look for infinite loops in your code.' },
    { text: 'Read the deployment logs for an exception nobody caught.', quote: 'Review the logs of the deployment to find unhandled exceptions.' }],
  again: 'If it keeps timing out, a slow outside service is the usual cause.', ...o });

test('the draft check passes a draft whose every step is backed by the official page, and fails one that invents', () => {
  const ok = checkDraft('Here you go: ' + draft() + ' done', { error: 'FUNCTION_INVOCATION_TIMEOUT', docText: DOC });
  assert.equal(ok.ok, true, ok.why); assert.equal(ok.steps.length, 4);
  const made = JSON.parse(draft());
  made.steps[0].quote = 'Increase the timeout to 900 seconds in settings.'; made.steps[1].quote = 'Restart the server.';
  assert.match(checkDraft(JSON.stringify(made), { error: 'FUNCTION_INVOCATION_TIMEOUT', docText: DOC }).why, /only 2 step/);
  assert.match(checkDraft(draft({ means: 'It is like EDGE_FUNCTION_INVOCATION_TIMEOUT or a 504 from the gateway, so the function stopped.' }), { error: 'FUNCTION_INVOCATION_TIMEOUT', docText: DOC }).why, /error codes the official page does not: EDGE_FUNCTION_INVOCATION_TIMEOUT, 504/);
  assert.match(checkDraft(draft({ means: 'See https://example.com for everything about this timeout and what it means for you.' }), { error: 'X', docText: DOC }).why, /no usable meaning/);
  assert.match(checkDraft('not json', { error: 'X', docText: DOC }).why, /JSON/);
  const row = pageRow({ platform: 'Vercel', error: 'FUNCTION_INVOCATION_TIMEOUT', doc: 'https://vercel.com/docs/errors/FUNCTION_INVOCATION_TIMEOUT' }, ok, { at: '2026-10-26T07:00:00Z', docTitle: 'FUNCTION_INVOCATION_TIMEOUT' });
  assert.equal(row.slug, 'vercel-function-invocation-timeout'); assert.equal(row.title, 'Vercel FUNCTION_INVOCATION_TIMEOUT: what it means and how to fix it');
  assert.deepEqual(row.checked, { at: '2026-10-26', url: 'https://vercel.com/docs/errors/FUNCTION_INVOCATION_TIMEOUT' }); assert.equal(row.made_by, 'verse');
});

test('price: Verse meets the rivals\' common starting price until it has sales, steps up with proven sales, steps down when clicks never buy', () => {
  const comps = [{ cents: 2000 }, { cents: 2500 }, { cents: 6000 }];
  const first = appraiseService({ comps });
  assert.equal(first.cents, 2500); assert.match(first.why, /^Why \$25: rivals charge \$20 to \$60/); assert.match(first.why, /no sales or reviews yet/);
  assert.equal(appraiseService({ comps, sales: 3 }).cents, 3400);
  assert.equal(appraiseService({ comps, sales: 30 }).cents, 6000);
  assert.equal(appraiseService({ comps, sales: 3, refunds: 1 }).cents, 2500);
  assert.equal(appraiseService({ comps, clicks: 40 }).cents, 2000);
  assert.equal(appraiseService({ comps: [] }).cents, 0);
});

test('learn: weights follow what each platform\'s pages earn; a page is retired only when old, seen and never wanted, and only Verse\'s own', () => {
  const sources = [{ platform: 'Vercel', weight: 0.7 }, { platform: 'Make', weight: 0.9 }];
  const pages = [{ slug: 'a', platform: 'Vercel', made_by: 'verse', added: '2026-07-01' }, { slug: 'b', platform: 'Make', made_by: 'verse', added: '2026-07-01' },
    { slug: 'c', platform: 'Make', added: '2026-07-01' }, { slug: 'd', platform: 'Vercel', made_by: 'verse', added: '2026-10-20' }];
  const stats = { a: { views: 200, clicks: 10, sales: 1 }, b: { views: 300 }, c: { views: 500 }, d: { views: 400 } };
  const w = learnWeights(sources, pages, stats);
  assert.equal(w.Make, 0.9); assert.ok(w.Vercel > 0.7 && w.Vercel <= 2.1);
  assert.deepEqual(toRetire(pages, stats, { now: Date.parse('2026-10-26') }), ['b']);
  assert.deepEqual(toRetire(pages, { b: { views: 99 } }, { now: Date.parse('2026-10-26') }), []);
});

test('the self card line says what was earned and what Verse tries next', () => {
  assert.equal(selfLine({ next: 'a fix page for Vercel DEPLOYMENT_NOT_FOUND', views: 12 }), 'Earned $0 this week from 12 offer views; next I\'m trying a fix page for Vercel DEPLOYMENT_NOT_FOUND.');
  assert.equal(selfLine({ week_cents: 5000, week_sales: 2, best: 'zapier-401-unauthorized', published: 1 }), 'Earned $50 this week from 2 sales (best: zapier-401-unauthorized); published 1 new fix page.');
});

test('sales per offer: the product (permalink) and the page that sent the buyer (utm_campaign), counts and totals only', () => {
  assert.deepEqual(offerOf(parsePing('permalink=eozcma&url_params[utm_campaign]=zapier-401-unauthorized&email=a@b.c')), { product: 'eozcma', page: 'zapier-401-unauthorized' });
  assert.deepEqual(offerOf(parsePing('product_permalink=https://moonbeam846.gumroad.com/l/yinmj?x=1&url_params[utm_campaign]=<script>')), { product: 'yinmj', page: 'direct' });
  const t = totals([{ resource: 'sale', sale_id: '1', raw: 'permalink=eozcma&url_params[utm_campaign]=zapier-401-unauthorized&price=2500' }, { resource: 'sale', sale_id: '2', raw: 'permalink=eozcma&price=2500&refunded=true' }]);
  assert.deepEqual(t.by_offer, { eozcma: { sales: 2, gross_cents: 5000, earned_cents: 2500 } });
  assert.deepEqual(t.by_page, { 'zapier-401-unauthorized': { sales: 1, gross_cents: 2500, earned_cents: 2500 }, direct: { sales: 1, gross_cents: 2500, earned_cents: 0 } });
  assert.ok(!JSON.stringify(t).includes('@'), 'no email ever reaches the totals');
});

test('the loop runs offline without writing and says spending is off with nothing earned', () => {
  const r = spawnSync(process.execPath, [resolve(here, 'earn.mjs'), '--offline'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.modelCalls, 0); assert.equal(j.fetches, 0); assert.deepEqual(j.published, []); assert.match(j.line, /^Earned \$0 this week/);
});
