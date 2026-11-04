// Under the hood (owner, 2026-11-03: "lets make it secretly amazing under the hood, i want anyone or anything to really be in awe of what we built").
// The files that make Verse fast and legible to machines, held to what each one promises:
//   /under-the-hood/          live numbers only: an external module, no inline script, no Pages Function called, no number typed in to look good
//   /speculation-rules.json   sent on every page by _headers; never prerenders the API, Functions, feeds or the 780-module home page
//   /visit.js                 a prerendered page counts its visit only once opened; page fades are off under reduced motion
//   /llms.txt, /agents.txt, /favicon.ico   markdown links an agent can follow, what an agent may do, and no 404 in every browser's console
// Run: node --test tools/under-the-hood.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const D = new URL('../void-live-deploy/', import.meta.url);
const read = (p) => readFileSync(new URL(p, D), 'utf8');

test('the page has no inline script and its module calls no Pages Function', () => {
  const html = read('under-the-hood/index.html'), js = read('under-the-hood/app.js');
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(([, a, body]) => !/\bsrc=/.test(a) && body.trim());
  assert.deepEqual(inline, [], 'an inline script needs a hash rule (tools/csp-hashes.mjs) and breaks a strict policy');
  assert.doesNotMatch(html, /\son[a-z]+=/i, 'an inline handler is blocked by a hashed policy');
  assert.match(html, /<script src="\/visit\.js" defer><\/script>/);
  const fetched = [...js.matchAll(/(?:fetch|text)\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(fetched.length >= 5, 'the page reads live files: ' + fetched.join(' '));
  for (const u of fetched) assert.ok(!u.startsWith('/api/') && u !== '/tools.json', u + ' runs a Pages Function on every view (STANDING: Cloudflare is not unlimited)');
  assert.doesNotMatch(js, /innerHTML/, 'every value is set with textContent');
});

test('each file the machines table fetches is served from the deploy folder', () => {
  const js = read('under-the-hood/app.js');
  const files = [...js.slice(js.indexOf('const FILES')).matchAll(/\['(\/[^']+)', '/g)].map((m) => m[1]).filter((u) => !u.startsWith('/api/') && u !== '/tools.json');
  assert.ok(files.length >= 10);
  const generated = ['/sitemap.xml']; // written at deploy (tools/generated.mjs)
  for (const u of files) assert.ok(generated.includes(u) || existsSync(new URL('.' + u, D)), u + ' is listed but not in void-live-deploy/');
});

test('speculation rules: sent on every page, served with the type Chrome reads, and never on the API, Functions, feeds or home', () => {
  const h = read('_headers'), star = h.slice(0, h.indexOf('\n\n'));
  assert.match(star, /^  Speculation-Rules: "\/speculation-rules\.json"$/m);
  assert.match(h, /^\/speculation-rules\.json\n  Content-Type: application\/speculationrules\+json$/m);
  const rules = JSON.parse(read('speculation-rules.json'));
  assert.deepEqual(Object.keys(rules).sort(), ['prefetch', 'prerender']);
  assert.equal(rules.prerender[0].eagerness, 'conservative', 'prerender runs a page\'s scripts, so only on pointer down, when the click is nearly certain');
  const routes = JSON.parse(read('_routes.json')).include;
  for (const kind of ['prefetch', 'prerender']) {
    const not = rules[kind][0].where.and.find((c) => c.not && c.not.href_matches).not.href_matches.map((p) => p.pathname);
    for (const r of routes) assert.ok(not.includes(r), kind + ' would fetch ' + r + ', which runs a Pages Function');
    if (kind === 'prerender') assert.ok(not.includes('/'), 'the home page boots about 780 modules: never prerendered on a guess');
  }
});

test('visit.js: a prerendered page waits to be opened, and fades respect reduced motion', () => {
  const v = read('visit.js');
  assert.match(v, /d\.prerendering \? d\.addEventListener\('prerenderingchange', loaded/);
  assert.match(v, /prefers-reduced-motion: reduce\)'\)\.matches\) \{[^}]*@view-transition\{navigation:auto\}/);
  assert.match(v, /e\.transferSize \|\| !e\.decodedBodySize/, 'a script downloaded on this load was asked for again, so a first visit fetched each file twice');
});

test('llms.txt starts with markdown links, agents.txt names the MCP server, favicon.ico is a real icon', () => {
  const l = read('llms.txt'), start = l.slice(l.indexOf('## Start here'), l.indexOf('## What you can ask for today'));
  assert.ok(start.length > 0 && l.indexOf('## Start here') < l.indexOf('## What you can ask for today'));
  assert.ok((start.match(/\[[^\]]+\]\(https:\/\/[^)]+\)/g) || []).length >= 6, 'llms.txt links are markdown links (llmstxt.org)');
  const a = read('agents.txt');
  for (const k of ['MCP: https://a-to-mind.com/api/mcp', 'OpenAPI: https://a-to-mind.com/openapi.json', 'Docs: https://a-to-mind.com/llms.txt']) assert.ok(a.includes(k), k);
  const ico = readFileSync(new URL('favicon.ico', D));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'an ICO header');
  assert.ok(ico.readUInt16LE(4) >= 2, 'more than one size');
});
