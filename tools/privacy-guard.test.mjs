// The privacy guard (tools/privacy-scan.mjs), the runtime guard (tools/runtime-guard.mjs), the CSP in _headers and the
// history mode of the one secret engine (tools/secret-scan.mjs --history).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { scanText, GUARDED } from './privacy-scan.mjs';
import { ownerChecks } from './runtime-guard.mjs';
import { headerFor } from './csp-smoke.mjs';

const at = (p) => new URL('../' + p, import.meta.url).pathname;
test('privacy scan flags personal data by kind, never the value, and passes placeholders', () => {
  const hits = scanText('a: jane.doe@gmail.com\nb: call 412-867-5309\nc: from 81.2.69.160\nd: [email] ops@example.com ask-20261010-0222-1 555-123-4567', 'domains/x.md');
  assert.deepEqual(hits.map((h) => h.kind + h.line), ['email1', 'phone2', 'ipv43']);
  assert.ok(!JSON.stringify(hits).includes('jane'));
  assert.equal(scanText('mail jane.doe@gmail.com <!-- privacy:ok -->').length, 0);
  // a standard's section number is not an address; a bare address after other words still is (lists run 2, 2026-10-21)
  assert.equal(scanText('section 4.25.7.2 requires it; see clause 5.1.2.3 and § 1.2.3.4', 'domains/x.md').length, 0);
  assert.equal(scanText('the reach was 81.2.69.160 today', 'domains/x.md').length, 1);
  assert.ok(GUARDED.test('domains/void.voice.md') && GUARDED.test('tools/fixtures/a.json') && !GUARDED.test('void-live-deploy/lib/x.js'));
});
test('the repo passes the privacy scan and the runtime guard', () => {
  for (const t of ['privacy-scan.mjs', 'runtime-guard.mjs']) { const r = spawnSync(process.execPath, [at('tools/' + t)], { cwd: at(''), encoding: 'utf8' }); assert.equal(r.status, 0, t + ': ' + r.stdout); }
  assert.deepEqual(ownerChecks(at('void-live-deploy')), []);
});
test('headers: strict CSP, HSTS, Referrer-Policy, Permissions-Policy', () => {
  const h = headerFor(at('void-live-deploy/_headers')), csp = h['Content-Security-Policy'];
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) assert.ok(csp.includes(d), d);
  assert.ok(!/script-src[^;]*(https:(?!\/\/)|\*|'unsafe-eval')/.test(csp), 'no wildcard or eval scripts');
  assert.match(h['Strict-Transport-Security'], /max-age=\d{8}/);
  assert.equal(h['Referrer-Policy'], 'no-referrer');
  assert.match(h['Permissions-Policy'], /camera=\(\)/);
});
test('secret-scan has a history mode', () => assert.match(readFileSync(at('tools/secret-scan.mjs'), 'utf8'), /--history/));

test('csp-hashes: hashes only inline scripts that run, one rule per page, inside the rule budget', async () => {
  const { inlineHashes, pathsOf, rules } = await import('./csp-hashes.mjs');
  const h = inlineHashes('<script>a()</script><script type="module">b()</script><script type="application/ld+json">{}</script><script src="/x.js"></script>');
  assert.equal(h.length, 2); assert.match(h[0], /^'sha256-[A-Za-z0-9+/]+=*'$/);
  assert.deepEqual(pathsOf('index.html'), ['/']); assert.deepEqual(pathsOf('films/index.html'), ['/films/']);
  const r = rules(); assert.ok(r.length > 0 && r.length <= 90 - 10, r.length + ' rules');
  assert.ok(r.every((x) => !/unsafe-inline/.test(x)));
  assert.ok(r.some((x) => x.startsWith('/fix/*\n')), 'the /fix/ pages share one splat rule, not one rule each');
  assert.ok(r.some((x) => x.startsWith('/fringe/*\n')), 'a directory of pages with different scripts shares one rule too (their union)');
  assert.ok(r.length + readFileSync(at('void-live-deploy/_headers'), 'utf8').split('\n').filter((l) => l.startsWith('/')).length <= 100, 'with the committed rules, inside Cloudflare\'s 100');
  for (const f of ['fringe/interval-timing.html', 'markets/screener/index.html', 'fix/index.html']) { // each page's own inline scripts are allowed by the rule that serves it
    let html; try { html = readFileSync(at('void-live-deploy/' + f), 'utf8'); } catch { continue; }
    const p = pathsOf(f)[0], hit = r.find((x) => x.startsWith(p + '\n')) || r.find((x) => { const head = x.split('\n')[0]; return head.endsWith('*') && p.startsWith(head.slice(0, -1)); });
    for (const h of inlineHashes(html)) assert.ok(hit && hit.includes(h), f + ' runs its own script ' + h);
  }
  assert.ok(!readFileSync(at('void-live-deploy/_headers'), 'utf8').includes('sha256-'), 'hashes are made at deploy, never committed');
});
