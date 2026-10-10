// node tools/review-pr.test.mjs: the PR review script against a stand-in /api/review. What the comment footer says when no closer read
// comes back must name only the side (access, model, network): the comment is public, so the exact reason stays in the function's log.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync, execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'void-review-pr-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q'); git('config', 'user.email', 't@x'); git('config', 'user.name', 't');
  writeFileSync(join(dir, 'a.js'), 'const a = 1;\n'); git('add', '-A'); git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD').trim();
  writeFileSync(join(dir, 'a.js'), 'const a = 1;\nfunction frob(n) {\n  return n * 2;\n}\n'); git('commit', '-qam', 'head');
  return { dir, base, head: git('rev-parse', 'HEAD').trim() };
}
async function serve(answer) {
  const srv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const a = typeof answer === 'function' ? answer(b) : answer; res.writeHead(a.status || 200, { 'content-type': 'application/json' }); res.end(a.body == null ? '' : typeof a.body === 'string' ? a.body : JSON.stringify(a.body)); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + srv.address().port + '/api/review', close: () => srv.close() };
}
const footerOf = (out) => (out.match(/<sub>Reviewed[^<]*/) || [''])[0];
// asynchronous on purpose: the stand-in server lives in this process, and a synchronous child would block the loop it answers from
const run = (r, url) => new Promise((resolve, reject) => execFile('node', [join(here, 'review-pr.mjs'), '--base', r.base, '--head', r.head, '--deep', url], { cwd: r.dir, encoding: 'utf8', env: { ...process.env, VOID_REVIEW_KEY: 'not-the-owner-key-0123456789' }, timeout: 30000 }, (err, stdout) => (err && !stdout ? reject(err) : resolve(stdout))));

test('the owner check fails at the API: the footer says "closer read unavailable (access)" and nothing else about why', async () => {
  const r = repo();
  const s = await serve({ body: { ok: true, findings: [], lang: 'javascript', lines: 4, ms: 3, tier: 'free', review: 'rules', upgrade: 'Void Code Review Pro adds a closer read by an AI reviewer: https://a-to-mind.com/code-review/#pro' } });
  try {
    const out = await run(r, s.url), f = footerOf(out);
    assert.match(f, /\(closer read unavailable \(access\)\)/);
    assert.doesNotMatch(f, /Pro|owner|https?:|READ_TOKEN|token|tier|free/i, 'no reason text beyond "access"');
    assert.doesNotMatch(out, /#### A closer read/);
  } finally { s.close(); }
});

test('a busy or switched-off model is "(model)", a dead or non-JSON answer is "(network)", and a real closer read shows its quoted counts', async () => {
  const r = repo();
  let s = await serve({ body: { ok: true, findings: [], tier: 'owner', review: 'rules', note: 'model busy' } });
  try { assert.match(footerOf(await run(r, s.url)), /closer read unavailable \(model\)/); } finally { s.close(); }
  s = await serve({ status: 500, body: 'no' });
  try { assert.match(footerOf(await run(r, s.url)), /closer read unavailable \(network\)/); } finally { s.close(); }
  s = await serve({ body: { ok: true, findings: [], tier: 'owner', review: 'model', answer: 'a.js:2 — style — fine as it is. — `function frob(n) {`', quoted: { kept: 1, dropped: 2 } } });
  try { const out = await run(r, s.url); assert.match(footerOf(out), /plus the closer read: 1 finding quoted from the diff, 2 claims about lines not in it dropped/); assert.match(out, /#### A closer read\n\na\.js:2/); } finally { s.close(); }
});
