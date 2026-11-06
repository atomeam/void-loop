// Starboard's live benchmark (lib/sitebench.js, functions/api/sitebench.js) counts only what its fetches brought back, and the Starboard page
// itself loads no file from another site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { siteOf, resourcesOf, hostsNamedIn, measurePage, bench, TARGETS, SELF_PATH } from '../void-live-deploy/lib/sitebench.js';
import { onRequestGet } from '../void-live-deploy/functions/api/sitebench.js';

const pages = {
  'https://rival.test/': '<html><head><script src="/a.js"></script><script src="https://ads.example.net/t.js"></script><link rel="stylesheet" href="s.css"><link rel="icon" href="/f.ico"></head><body><img src="//cdn.rival.test/i.png"></body></html>',
  'https://rival.test/a.js': 'fetch("https://track.example.org/p")',
  'https://ads.example.net/t.js': 'x',
  'https://rival.test/s.css': 'body{}',
};
const fake = async (url) => {
  const body = pages[url];
  if (body == null) return { ok: false, status: 404, url, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0) };
  return { ok: true, status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), arrayBuffer: async () => new TextEncoder().encode(body).buffer };
};

test('siteOf keeps the registrable part of a host', () => {
  assert.equal(siteOf('cdn.rival.test'), 'rival.test');
  assert.equal(siteOf('www.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(siteOf('a-to-mind.com'), 'a-to-mind.com');
});

test('resourcesOf lists what the html names, as absolute addresses', () => {
  const r = resourcesOf(pages['https://rival.test/'], 'https://rival.test/');
  assert.deepEqual(r.scripts, ['https://rival.test/a.js', 'https://ads.example.net/t.js']);
  assert.deepEqual(r.styles, ['https://rival.test/s.css']);
  assert.deepEqual(r.images, ['https://cdn.rival.test/i.png']);
  assert.deepEqual(hostsNamedIn(pages['https://rival.test/a.js']), ['track.example.org']);
});

test('measurePage counts the requests, the bytes that came back and the hosts off the site', async () => {
  let t = 0; const row = await measurePage('rival', 'https://rival.test/', { fetchImpl: fake, now: () => (t += 5) });
  assert.equal(row.ok, true);
  assert.equal(row.requests, 6); // the page, 2 scripts, 1 style, 1 icon, 1 image
  assert.equal(row.scripts, 2);
  assert.equal(row.html_bytes, new TextEncoder().encode(pages['https://rival.test/']).byteLength);
  assert.ok(row.failed >= 2, 'the icon and the image did not answer');
  assert.deepEqual(row.third_party, ['ads.example.net']);
  assert.deepEqual(row.script_third_party, ['track.example.org']);
  assert.ok(Number.isFinite(row.ms) && row.ms > 0);
});

test('a page that does not answer gives no numbers, only the error', async () => {
  const row = await measurePage('gone', 'https://gone.test/', { fetchImpl: fake });
  assert.equal(row.ok, false);
  assert.equal(row.bytes, undefined);
});

test('bench measures the rival and Starboard, and the route measures only its listed sites', async () => {
  assert.equal(TARGETS['dalyfeds.com'], 'https://dalyfeds.com/');
  assert.equal(SELF_PATH, '/starboard/');
  const res = await onRequestGet({ request: new Request('https://a-to-mind.com/api/sitebench?site=evil.test') });
  assert.equal(res.status, 404);
  assert.equal(typeof bench, 'function');
});

test('the Starboard page loads no script, style or image from another site', () => {
  const html = readFileSync(new URL('../void-live-deploy/starboard/index.html', import.meta.url), 'utf8');
  const loads = [...html.matchAll(/<(script|link|img|iframe)\b[^>]*?\s(?:src|href)\s*=\s*"([^"]+)"/gi)].filter((m) => !/^<link\b[^>]*rel="canonical"/i.test(m[0])).map((m) => m[2]);
  const outside = loads.filter((u) => /^(?:https?:)?\/\//i.test(u) && !/^https:\/\/a-to-mind\.com\//.test(u));
  assert.deepEqual(outside, []);
  assert.match(html, /\/verse-shell\.js/);
  assert.match(html, /href="\/"/, 'links back to the homepage');
  for (const p of ['/conquered/', '/treasury/', '/lab/']) assert.ok(html.includes('href="' + p + '"'), 'links to ' + p);
});
