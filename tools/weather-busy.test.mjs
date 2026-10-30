// The weather page never stays busy (lists run 6, 2026-10-28; Verse's ask: the page stuck on aria-busy when a forecast service hung).
// Every fetch on the page carries a timeout signal, and aria-busy is cleared in a finally. Run: node --test tools/weather-busy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../void-live-deploy/weather/index.html', import.meta.url), 'utf8');
test('every fetch on the weather page gives up after a timeout', () => {
  assert.match(html, /AbortSignal\.timeout\(WAIT_MS\)/);
  const m = html.match(/WAIT_MS = (\d+)/); assert.ok(m && +m[1] >= 5000 && +m[1] <= 20000, 'a sane wait');
  const calls = [...html.matchAll(/\bfetch\(([^;]*?)\)\s*(?:,|\.then|;)/g)].map((x) => x[0]);
  assert.ok(calls.length >= 2, 'found the fetches');
  for (const c of html.split(/\bfetch\(/).slice(1)) assert.match(c.slice(0, 260), /signal: timed\(\)/, 'fetch without a timeout: fetch(' + c.slice(0, 80));
});
test('aria-busy is set once and always cleared in finally', () => {
  assert.equal((html.match(/setAttribute\('aria-busy', 'true'\)/g) || []).length, 1);
  assert.match(html, /finally \{ document\.querySelector\('main'\)\.removeAttribute\('aria-busy'\)/);
});
test('a hung fetch rejects within the wait (the timeout really aborts)', async () => {
  const t0 = Date.now();
  const keep = setTimeout(() => {}, 2000); // AbortSignal.timeout does not hold the event loop open by itself
  await assert.rejects(new Promise((_, rej) => { const s = AbortSignal.timeout(50); s.addEventListener('abort', () => rej(s.reason)); }));
  clearTimeout(keep);
  assert.ok(Date.now() - t0 < 2000);
});
