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
  assert.ok(GUARDED.test('domains/void.voice.md') && GUARDED.test('tools/fixtures/a.json') && !GUARDED.test('void-live-deploy/lib/x.js'));
});
test('the repo passes the privacy scan and the runtime guard', () => {
  for (const t of ['privacy-scan.mjs', 'runtime-guard.mjs']) { const r = spawnSync(process.execPath, [at('tools/' + t)], { cwd: at(''), encoding: 'utf8' }); assert.equal(r.status, 0, t + ': ' + r.stdout); }
  assert.deepEqual(ownerChecks(at('void-live-deploy')), []);
});
test('headers: strict CSP, HSTS, Referrer-Policy, Permissions-Policy', () => {
  const h = headerFor(at('void-live-deploy/_headers')), csp = h['Content-Security-Policy'];
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", 'frame-ancestors', 'upgrade-insecure-requests']) assert.ok(csp.includes(d), d);
  assert.ok(!/script-src[^;]*(https:|\*|'unsafe-eval')/.test(csp), 'no remote or eval scripts');
  assert.match(h['Strict-Transport-Security'], /max-age=\d{8}/);
  assert.equal(h['Referrer-Policy'], 'no-referrer');
  assert.match(h['Permissions-Policy'], /camera=\(\)/);
});
test('secret-scan has a history mode', () => assert.match(readFileSync(at('tools/secret-scan.mjs'), 'utf8'), /--history/));
