// What Verse builds from what it watched: the pick, the page match, the product, the job, the spec, the served log, and the conductor route.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { scoreIdea, matchPage, productFor, planCycle, jobOf, tvSpec, assembleLog, slugOf } from '../void-live-deploy/lib/watch-build.js';
import { ROUTES, WEIGHT } from './conductor-core.mjs';
import { briefOf } from '../void-live-deploy/lib/job-guide.js';

const fake = { kind: 'idea', medium: 'tv', station: 'WFTV', network: 'ABC', day: '2026-10-30', at: '2026-10-30T22:13:23.394Z', topic: 'AI authenticity checker', note: 'A tool to help law enforcement verify if video evidence has been synthetically altered.' };
const snack = { kind: 'idea', medium: 'radio', station: 'WXYZ', day: '2026-10-31', at: '2026-10-31T10:00:00Z', topic: 'Healthy snack alternatives', note: 'A list of healthy snack swaps for kids.' };
const vr = { kind: 'idea', medium: 'tv', station: 'KABC', day: '2026-10-31', at: '2026-10-31T11:00:00Z', topic: 'VR museum tour', note: 'A virtual reality headset tour of local museums and their price lists.' };
const ween = { kind: 'idea', medium: 'tv', station: 'KABC', day: '2026-10-29', at: '2026-10-29T11:00:00Z', topic: 'Halloween costume planner', note: 'A planner to compare costume prices before Halloween.' };

test('a useful idea that can earn scores high; hardware and a passed holiday sink', () => {
  assert.equal(scoreIdea(fake).score, 7);
  assert.ok(scoreIdea(vr, '2026-11-03').score < 3, 'a headset is not a web page');
  assert.ok(scoreIdea(ween, '2026-11-03').score < scoreIdea(ween, '2026-10-20').score, 'Halloween after the day is worth less');
});

test('the plan picks the best idea not built yet, and a new page when none matches', () => {
  const p = planCycle([snack, vr, fake], { pages: [{ route: '/video/', title: 'Video player' }], today: '2026-11-03' });
  assert.equal(p.slug, 'ai-authenticity-checker'); assert.equal(p.action, 'new'); assert.equal(p.page, '/ai-authenticity-checker/');
  assert.equal(p.product.url, 'https://moonbeam846.gumroad.com/l/yinmj');
  assert.equal(planCycle([fake], { built: ['ai-authenticity-checker'] }), null, 'a built idea is not built twice');
  assert.equal(planCycle([{ ...vr }], { today: '2026-11-03' }), null, 'nothing worth building is no plan, not a list');
  assert.equal(planCycle([{ ...fake, kind: 'fact' }]), null, 'only idea notes become builds');
});

test('a page that already does the job is improved, not duplicated', () => {
  const pages = [{ route: '/healthy-snacks/', title: 'Healthy snack swaps', desc: 'healthier snack ideas for kids' }];
  assert.equal(matchPage(snack, pages).route, '/healthy-snacks/');
  const p = planCycle([{ ...snack, note: snack.note + ' Compare the price of each.' }], { pages, today: '2026-11-03' });
  assert.equal(p.action, 'improve'); assert.equal(p.page, '/healthy-snacks/');
  assert.equal(matchPage(fake, [{ route: '/video/', title: 'Video player' }]), null, 'one shared word is not the same job');
});

test('each build names a store product', () => {
  assert.match(productFor({ topic: 'uptime monitor', note: 'tell me about an outage' }).url, /keep-it-running/);
  assert.match(productFor({ topic: 'Zap fixer', note: 'fix a broken automation workflow' }).url, /eozcma/);
  assert.match(productFor(fake).url, /yinmj/);
});

test('the job fits the queue and carries its source; the spec rebuilds from the ask', () => {
  const p = planCycle([fake], { today: '2026-11-03' }), j = jobOf(p);
  assert.equal(j.target, 'tv:ai-authenticity-checker'); assert.ok(j.target.length <= 40 && j.ask.length <= 200);
  assert.match(j.ask, /^Build \/ai-authenticity-checker\/: AI authenticity checker \(heard on WFTV/);
  const spec = tvSpec({ id: 'j9', ...j });
  assert.match(spec, /build \/ai-authenticity-checker\//); assert.match(spec, /yinmj/); assert.match(spec, /tools\/real-pages\.mjs/); assert.match(spec, /domains\/tv-built\/ai-authenticity-checker\.json/); assert.match(spec, /"j9"/);
  assert.match(tvSpec({ target: 'tv:x', ask: 'Improve /healthy-snacks/: snacks (heard on WXYZ)' }), /Improve that page; do not add a second page/);
  assert.match(briefOf({ id: 'j9', ...j }, 'tv'), /never an idea list/);
});

test('the conductor routes tv jobs to the coder, ahead of plain features', () => {
  assert.equal(ROUTES.tv.wf, ROUTES.feature.wf); assert.ok(ROUTES.tv.claims);
  assert.ok(WEIGHT.tv > WEIGHT.feature && WEIGHT.tv < WEIGHT.member);
});

test('the served log is newest first with each pull request, and every lineage file is whole', () => {
  const log = assembleLog([{ slug: 'a', feature: '/a/', shipped: '2026-11-01', _file: 'a' }, { slug: 'b', feature: '/b/', shipped: '2026-11-03', _file: 'b' }, { slug: 'c' }], (f) => (f === 'b' ? 12 : null));
  assert.deepEqual(log.map((e) => [e.slug, e.pr]), [['b', 12], ['a', null]]); assert.ok(!('_file' in log[0]));
  const dir = new URL('../domains/tv-built/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const e = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.equal(e.slug + '.json', f); assert.match(e.feature, /^\/[a-z0-9-]+\/$/); assert.ok(e.source && e.source.station && e.source.day, f + ' names its broadcast');
    assert.match(e.product.url, /^https:\/\/moonbeam846\.gumroad\.com\/l\//, f + ' earns through the store');
    assert.ok(readdirSync(new URL('../void-live-deploy' + e.feature, import.meta.url)).includes('index.html'), f + ' points at a real page');
  }
  assert.equal(slugOf('AI authenticity checker!'), 'ai-authenticity-checker');
});
