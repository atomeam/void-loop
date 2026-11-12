// tools/propose-fix.mjs (closed PR #2335's leftover, lists run 25): an HTTP error is logged by the platform's own reason (an edge error
// page's title and code such as 1102, a JSON error's message) instead of the page's first bytes, and an edited skill that does not load
// names the bracket the edit left open or closed twice.
// Run: node --test tools/propose-fix-reasons.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { httpReason, openBracket, loadWhy, letsGo } from './propose-fix.mjs';

test('an edge error page is its title and code, not its first bytes', () => {
  const page = '<!DOCTYPE html><html><head><title>Worker exceeded resource limits | a-to-mind.com | Cloudflare</title></head><body><h1>Error 1102</h1><p>Ray ID: 8f</p></body></html>';
  assert.equal(httpReason(503, page), 'HTTP 503: Worker exceeded resource limits (error 1102)');
  assert.equal(httpReason(502, '<html><head><title>a-to-mind.com | 502: Bad gateway</title></head><body>Error code 502</body></html>'), 'HTTP 502: Bad gateway');
  assert.equal(httpReason(520, '<html><body>nothing useful</body></html>'), 'HTTP 520 (an HTML error page)');
});
test('a JSON error is its message; plain text is kept short', () => {
  assert.equal(httpReason(500, '{"ok":false,"error":"the queue is off"}'), 'HTTP 500: the queue is off');
  assert.equal(httpReason(404, 'not found'), 'HTTP 404 not found');
  assert.equal(httpReason(500, ''), 'HTTP 500');
  assert.ok(httpReason(500, 'x'.repeat(500)).length < 140);
});
test('openBracket names the bracket left open, or the closer with nothing to close', () => {
  assert.deepEqual(openBracket('function f() {\n  if (x) {\n    return 1;\n}\n'), { char: '{', line: 1 });
  assert.deepEqual(openBracket('const a = [1, 2;\n'), { char: '[', line: 1 });
  assert.deepEqual(openBracket('const a = 1);'), { char: ')', line: 1, closes: null });
  assert.deepEqual(openBracket('const a = { b: (1 };'), { char: '}', line: 1, closes: '(' });
});
test('brackets in strings, templates, comments and regexes do not count', () => {
  assert.equal(openBracket('const a = "{", b = \'(\', c = `[${"}"}]`; // {\n/* ( */ const r = /[}(]/g; if (x) { return /\\)/.test(y); }'), null);
  assert.equal(openBracket('const half = (a) => a / 2 / 3;'), null);
  assert.equal(openBracket('const t = `a ${b ? `c ${d}` : "}"} e`;'), null);
});
test('no false alarm on any skill the page loads', () => {
  const dir = new URL('../void-live-deploy/skills/', import.meta.url).pathname;
  const flagged = readdirSync(dir).filter((f) => f.endsWith('.js')).filter((f) => openBracket(readFileSync(path.join(dir, f), 'utf8')));
  assert.deepEqual(flagged, []);
});
test('an edited skill that does not load says which bracket', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pf-')), file = path.join(dir, 'broken.mjs');
  writeFileSync(file, "export default {\n  name: 'broken',\n  match(lower) {\n    return lower === 'x';\n};\n");
  const why = await letsGo(file, 'x');
  assert.match(why, /^the edited skill did not load: /);
  assert.match(why, /the \{ opened on line 1 is never closed/);
  assert.equal(loadWhy(file, new Error('Cannot find module x')), 'Cannot find module x', 'a non-syntax error is left as it is');
});
