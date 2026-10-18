// node --test tools/review-api.test.mjs: Verse's code review API (functions/api/review.js, lib/review-api.js) on a real
// SQLite standing in for D1: the free instant checks, Pro keys (minted only by a paid account, stored as a hash, refused
// once the account is free again), the closer read and its daily cap, revoking, and "forget me" taking the keys too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import * as api from '../void-live-deploy/functions/api/review.js';
import { ensureTables, sessionId } from '../void-live-deploy/lib/void-me.js';
import { relatedPaths, widestDiff, applyVerdicts, verifyMessages, closerReadDetail, quick, KEY_RE, PRO_DAILY, keyHash, today, cleanImports, importsText, declaredNames, dropPhantoms, phantomNames, DIFF_RULE, MASK_RULE, clipForModel, CLIP_RULE, MODEL_CODE_MAX, JSON_RULE, FINDINGS_SCHEMA, parseFinding, evidenceLines, quoteCheck, parseFindingsJson, validateFindings, renderFindings, knownFalse, CSS_RULE, uncountedGroupClaim, REGEX_RULE } from '../void-live-deploy/lib/review-api.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const st = (sql, a = []) => ({ sql, a, bind: (...b) => st(sql, b), first: async (c) => { const r = db.prepare(sql).get(...a) ?? null; return c ? (r ? r[c] : null) : r; }, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => db.prepare(sql).run(...a) });
  return { db, prepare: (sql) => st(sql), batch: async (list) => { db.exec('BEGIN'); try { for (const s of list) db.prepare(s.sql).run(...s.a); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}
const TOKEN = 'a'.repeat(43), USER = 'user-1';
async function envWith({ tier = 'paid', ai } = {}) {
  const env = { DB: d1(), AI: ai };
  await ensureTables(env);
  env.DB.db.prepare('INSERT INTO void_sessions (id, user_id, at, expires) VALUES (?, ?, ?, ?)').run(await sessionId(TOKEN), USER, 'now', Date.now() + 1e9);
  env.DB.db.prepare("INSERT INTO void_accounts (user_id, tier, updated) VALUES (?, ?, 'now')").run(USER, tier);
  return env;
}
const call = (fn, env, body, auth) => fn({ request: new Request('https://a-to-mind.com/api/review', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: body == null ? undefined : JSON.stringify(body) }), env });
const ai = (reply, calls = []) => ({ run: async (m, o) => { calls.push(o); return { response: reply }; } });
const BUGGY = 'function f(x) {\n  if (x = 5) { return eval(x); }\n}';

test('free: the instant checks, no account, in milliseconds, with an upgrade line', async () => {
  const env = await envWith();
  const r = await (await call(api.onRequestPost, env, { code: BUGGY })).json();
  assert.equal(r.tier, 'free'); assert.equal(r.review, 'rules');
  assert.ok(r.findings.some((f) => f.rule === 'assign-in-condition' && f.line === 2), JSON.stringify(r.findings));
  assert.ok(r.ms < 500 && /code-review/.test(r.upgrade));
  assert.equal((await call(api.onRequestPost, env, { code: 'x' })).status, 400);
});

test('a diff is checked on its added lines, with the new file\'s line numbers', () => {
  const diff = 'diff --git a/a.js b/a.js\n--- a/a.js\n+++ b/a.js\n@@ -10,2 +10,3 @@\n const a = 1;\n-if (a === 5) go();\n+if (a = 5) go();\n+const b = 2;\n';
  const q = quick({ diff });
  assert.deepEqual(q.findings.filter((f) => f.kind === 'bug').map((f) => f.line), [11]);
});

test('Pro keys: only a paid account mints one; only its hash is kept; it unlocks the closer read', async () => {
  const calls = [], env = await envWith({ ai: ai(JSON.stringify({ findings: [{ file: '', line: 2, kind: 'bug', text: '= should be ===', quote: '  if (x = 5) { return eval(x); }' }] }), calls) });
  assert.equal((await call(api.onRequestPost, env, { action: 'key' })).status, 401);
  const m = await (await call(api.onRequestPost, env, { action: 'key' }, TOKEN)).json();
  assert.ok(KEY_RE.test(m.key), m.key);
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_review_keys WHERE hash = ?').get(await keyHash(m.key)).n, 1);
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_review_keys WHERE hash = ?').get(m.key).n, 0, 'the key itself is never stored');
  const r = await (await call(api.onRequestPost, env, { code: BUGGY + '\nconst k = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";' }, m.key)).json();
  assert.equal(r.tier, 'pro'); assert.equal(r.review, 'model'); assert.match(r.answer, /===/);
  assert.equal(r.left, PRO_DAILY - 1);
  assert.ok(!JSON.stringify(calls).includes('abcdefghijklmnopqrstuvwxyz0123456789'), 'keys in the code are masked before the model sees them');
  const g = await (await api.onRequestGet({ request: new Request('https://a-to-mind.com/api/review', { headers: { authorization: 'Bearer ' + TOKEN } }), env })).json();
  assert.equal(g.keys.length, 1); assert.equal(g.keys[0].total, 1); assert.equal(g.keys[0].prefix, m.key.slice(0, 10));
});

test('a free account gets no key; a refunded account\'s key falls back to the free checks; unknown keys are refused', async () => {
  const env = await envWith({ tier: 'free', ai: ai('x') });
  const r = await call(api.onRequestPost, env, { action: 'key' }, TOKEN);
  assert.equal(r.status, 402); assert.match((await r.json()).buy, /code-review/);
  const paid = await envWith({ ai: ai('closer read') });
  const { key } = await (await call(api.onRequestPost, paid, { action: 'key' }, TOKEN)).json();
  paid.DB.db.prepare("UPDATE void_accounts SET tier = 'free'").run();
  const back = await (await call(api.onRequestPost, paid, { code: BUGGY }, key)).json();
  assert.equal(back.tier, 'free'); assert.equal(back.answer, undefined); assert.ok(back.findings.length);
  assert.equal((await call(api.onRequestPost, paid, { code: BUGGY }, 'vr1.' + 'b'.repeat(43))).status, 401);
});

test('the daily cap, five keys at most, revoking, and forget me', async () => {
  const env = await envWith({ ai: ai('ok') });
  const keys = [];
  for (let i = 0; i < 5; i++) keys.push((await (await call(api.onRequestPost, env, { action: 'key' }, TOKEN)).json()).key);
  assert.equal((await call(api.onRequestPost, env, { action: 'key' }, TOKEN)).status, 409);
  env.DB.db.prepare('UPDATE void_review_keys SET day = ?, uses = ? WHERE hash = ?').run(today(), PRO_DAILY, await keyHash(keys[0]));
  const capped = await (await call(api.onRequestPost, env, { code: BUGGY }, keys[0])).json();
  assert.equal(capped.tier, 'pro'); assert.equal(capped.answer, undefined); assert.match(capped.note, /used/);
  const del = await api.onRequestDelete({ request: new Request('https://a-to-mind.com/api/review', { method: 'DELETE', headers: { authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ prefix: keys[1].slice(0, 10) }) }), env });
  assert.equal(del.status, 200);
  assert.equal((await call(api.onRequestPost, env, { code: BUGGY }, keys[1])).status, 401, 'a revoked key stops working');
  const passkey = await import('../void-live-deploy/functions/api/passkey.js');
  const f = await passkey.onRequestPost({ request: new Request('https://a-to-mind.com/api/passkey', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN }, body: JSON.stringify({ step: 'forget' }) }), env });
  assert.equal(f.status, 200, await f.clone().text());
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_review_keys').get().n, 0, 'forget me removes the review keys');
});

test('Verse Code Review Pro on its own: a Gumroad license key, checked with Gumroad and remembered; refunds turn it off', async () => {
  const LIC = 'A1B2C3D4-E5F60718-293A4B5C-6D7E8F90', asked = [];
  let purchase = { refunded: false, test: false };
  const gumroad = async (url, init) => { asked.push(String(init.body)); const k = new URLSearchParams(init.body).get('license_key'); return k === LIC ? Response.json({ success: true, purchase }) : Response.json({ success: false, message: 'That license does not exist for the provided product.' }, { status: 404 }); };
  const env = await envWith({ ai: ai('closer read') });
  env.fetchGumroad = gumroad;
  // the store catalog knows the product by its permalink (dkmcjk) and holds Gumroad's long id for it
  const { ensureStoreTables } = await import('../void-live-deploy/lib/store-db.js');
  await ensureStoreTables(env);
  env.DB.db.prepare("INSERT INTO void_catalog (slug, data, available, updated) VALUES ('dkmcjk', ?, 1, 'now')").run(JSON.stringify({ id: 'prod123==', short: 'dkmcjk', name: 'Verse Code Review Pro' }));
  const r = await (await call(api.onRequestPost, env, { code: BUGGY }, LIC)).json();
  assert.equal(r.tier, 'pro'); assert.equal(r.review, 'model'); assert.ok(r.left > 0);
  assert.match(asked[0], /product_id=prod123/); assert.ok(!/product_permalink/.test(asked[0])); assert.match(asked[0], /increment_uses_count=false/);
  await call(api.onRequestPost, env, { code: BUGGY }, LIC.toLowerCase());
  assert.equal(asked.length, 1, 'the answer is remembered (and the key is case-blind)');
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM void_licenses WHERE hash LIKE ?').get('%' + LIC + '%').n, 0, 'only a hash of the license is kept');
  purchase = { refunded: true };
  env.DB.db.prepare('UPDATE void_licenses SET checked = 0').run(); // hours later
  const after = await (await call(api.onRequestPost, env, { code: BUGGY }, LIC)).json();
  assert.equal(after.tier, 'free'); assert.match(after.note, /refunded/); assert.ok(after.findings.length, 'the free checks still run');
  assert.equal((await call(api.onRequestPost, env, { code: BUGGY }, 'FFFFFFFF-FFFFFFFF-FFFFFFFF-FFFFFFFF')).status, 401);
  const offer = await (await api.onRequestGet({ request: new Request('https://a-to-mind.com/api/review?offer'), env })).json();
  assert.equal(offer.standalone.url, 'https://moonbeam846.gumroad.com/l/dkmcjk'); assert.match(offer.included.url, /yinmj/);
});

test('before the catalog has seen the product, the license is checked by its permalink instead', async () => {
  const { askGumroad } = await import('../void-live-deploy/lib/products.js');
  let body = '';
  const r = await askGumroad('', 'A1B2C3D4-E5F60718-293A4B5C-6D7E8F90', async (u, init) => { body = String(init.body); return Response.json({ success: true, purchase: {} }); }, 'dkmcjk');
  assert.equal(r.ok, true); assert.match(body, /product_permalink=dkmcjk/); assert.ok(!/product_id/.test(body));
});

test('the owner always gets the closer read, free, with no daily cap', async () => {
  const env = await envWith({ ai: ai('owner read') });
  env.READ_TOKEN = 'owner-secret-0123456789';
  for (let i = 0; i < 3; i++) {
    const r = await (await call(api.onRequestPost, env, { code: BUGGY }, env.READ_TOKEN)).json();
    assert.equal(r.tier, 'owner'); assert.equal(r.review, 'model'); assert.equal(r.left, undefined);
  }
  const wrong = await (await call(api.onRequestPost, env, { code: BUGGY }, 'not-the-owner-key-000')).json();
  assert.equal(wrong.tier, 'free');
});

// The closer read sees only the diff: without the file's imports it called `redact` and `INJECTION_RULE` missing on #254 and the
// "[redacted]" mask a syntax error on #256. The imports go along now, the prompt says so, and the filter catches a model that ignores it.
const PHANTOM_READ = JSON.stringify({ findings: [
  { file: 'answer.js', line: 149, kind: 'bug', text: 'The `draftAnswer` function uses `redact`, but `redact` is not defined in answer.js. This will cause a ReferenceError.', quote: '  const p = prepareDraft(body, redact);' },
  { file: 'answer.js', line: 144, kind: 'bug', text: '`INJECTION_RULE` is used but is not imported or defined in the provided snippet.', quote: "  const m = [{ role: 'system', content: DRAFT_SYSTEM + INJECTION_RULE }];" },
  { file: 'answer.js', line: 150, kind: 'bug', text: '`frobnicate(p)` is called but `frobnicate` is not defined anywhere.', quote: '  return frobnicate(p);' },
  { file: 'answer.js', line: 28, kind: 'risk', text: '`TOKEN` is assigned using `[redacted]`, which is not a valid value.', quote: "  const m = [{ role: 'system', content: DRAFT_SYSTEM + INJECTION_RULE }];" },
] });
test('closer read on a diff: the touched file\'s imports go to the model with the rule, a "not defined" claim about an imported name or about the mask is dropped, and a genuinely undefined name stays', async () => {
  const calls = []; const env = await envWith({ ai: ai(PHANTOM_READ, calls) }); env.READ_TOKEN = 'owner-secret-0123456789';
  const diff = 'diff --git a/answer.js b/answer.js\n--- a/answer.js\n+++ b/answer.js\n@@ -140,3 +140,6 @@\n async function draftAnswer(request, env, body) {\n+  const p = prepareDraft(body, redact);\n+  const m = [{ role: \'system\', content: DRAFT_SYSTEM + INJECTION_RULE }];\n+  return frobnicate(p);\n }\n';
  const r = await (await call(api.onRequestPost, env, { diff, imports: { 'answer.js': ["import { redact, INJECTION_RULE } from '../../lib/automation-fix.js';", "import { prepareDraft, DRAFT_SYSTEM } from '../../lib/draft.js';"] } }, env.READ_TOKEN)).json();
  assert.equal(r.review, 'model');
  const sys = calls[0].messages[0].content, user = calls[0].messages[1].content;
  assert.ok(user.includes(DIFF_RULE), 'the diff rule'); assert.ok(user.includes('answer.js:\n  import { redact, INJECTION_RULE }'), 'the imports'); assert.ok(sys.includes(MASK_RULE), 'the mask rule'); assert.ok(sys.includes(JSON_RULE), 'JSON only');
  assert.deepEqual(calls[0].response_format, { type: 'json_schema', json_schema: FINDINGS_SCHEMA }, 'JSON mode asked for');
  assert.doesNotMatch(r.answer, /redact` is not defined|INJECTION_RULE` is used|\[redacted\]/);
  assert.match(r.answer, /^answer\.js:143 — bug — `frobnicate\(p\)` is called but `frobnicate` is not defined anywhere\. — `return frobnicate\(p\);`/m, 'the real finding, its line taken from the quote (150 was wrong)');
  assert.match(r.answer, /1 finding, each quoting its line: 1 bug\./);
  assert.deepEqual(r.quoted, { kept: 1, dropped: 3, parsed: true, echoes: 0, refuted: 0 });
});

test('the phantom filter on its own handles a model that ignores the rule: names a file imports or declares, in both languages', () => {
  const known = declaredNames("import { redact } from './x.js';\nimport * as G from './g.js';\nimport D, { e as f } from './d.js';\nconst { a, b: c } = require('y');\nexport async function helper() {}\nclass K {}\nconst [p, q] = pair();\nfrom os import path as P\nimport json\ndef run():\n  pass\nLIMIT = 3\n");
  for (const n of ['redact', 'G', 'D', 'f', 'a', 'c', 'helper', 'K', 'p', 'q', 'P', 'json', 'run', 'LIMIT']) assert.ok(known.has(n), n);
  assert.ok(!known.has('b') && !known.has('e'));
  assert.deepEqual(phantomNames('`redact` is not defined here', known), ['redact']);
  assert.deepEqual(phantomNames('`nothere` is not defined here', known), []);
  assert.deepEqual(phantomNames('`redact` could be slow', known), []);
  assert.deepEqual(phantomNames('`x` is set to `[redacted]`, which is not valid', known), ['mask']);
  assert.equal(dropPhantoms('### Bugs\n\n* `redact` is not defined.\n\n### Style\n\n* long line', known), '### Style\n\n* long line');
  assert.equal(dropPhantoms('* `nothere` is not defined.', known), '* `nothere` is not defined.');
  assert.equal(dropPhantoms('all fine', new Set()), 'all fine');
  // a paragraph that also names a real undeclared identifier (used as a bare call in the code) is a finding to keep
  const code = 'const p = redact(x);\nreturn frobnicate(p);\nconst o = { messages: [] };';
  assert.deepEqual(phantomNames('`redact` is fine but `frobnicate` is not defined', known, code), []);
  assert.deepEqual(phantomNames('`redact` is used in the `messages` array but is not defined (see `answer.js`, inside the `try` block)', known, code), ['redact']);
});

test('imports from the request are cleaned and capped before they reach the prompt', () => {
  assert.equal(cleanImports(null), null); assert.equal(cleanImports([1]), null); assert.equal(cleanImports({ 'a.js': [] }), null);
  const big = cleanImports({ 'a.js': Array.from({ length: 100 }, (_, i) => 'import x' + i + ' from "y";'), 'b.js': ['x'.repeat(400)] });
  assert.equal(big['a.js'].length, 60); assert.equal(big['b.js'][0].length, 300);
  assert.ok(cleanImports({ 'a.js': Array.from({ length: 50 }, () => 'i'.repeat(300)) })['a.js'].length <= 20);
  assert.match(importsText({ 'a.js': ['import a from "b";'] }), /^What each touched file imports or declares at top level \(outside the diff\):\na\.js:\n  import a from "b";$/);
});

// #262: the diff ran past MODEL_CODE_MAX, the old hard cut landed inside a fringe draft's flash() line, and the closer read
// reported the function "truncated/cut off in the middle of a line" (it was whole in the file). Now the model sees whole lines
// and a note saying the rest was left out, the prompt says what the note means, and a cut-off claim is dropped when it ran anyway.
const FLASH = "  function flash(delayMs) { setTimeout(() => { el('dot').style.visibility = 'visible'; setTimeout(() => { el('dot').style.visibility = 'hidden'; }, 17); }, delayMs); }";
const READ_262 = JSON.stringify({ findings: [
  { file: 'drafts/fringe/sensory-substitution-7.html', line: 75, kind: 'bug', text: 'The `flash` function is truncated/cut off in the middle of a line. This will cause a syntax error.', quote: FLASH.trim() },
  { file: 'drafts/fringe/sensory-substitution-7.html', line: 30, kind: 'style', text: '`keep` is recomputed on every addition; keep a running map.', quote: 'const keep = 1; // padding line that makes the diff long enough' },
] });
const READ_262_PROSE = '### Bugs\n*   **Line 75 (inferred):** The `flash` function is truncated/cut off in the middle of a line.\n\n### Performance\n*   **Line 30:** `counts` is recomputed on every addition; keep a running map.';
const longDiff = () => { // the flash() line straddles MODEL_CODE_MAX, as it did on #262
  const pad = '+  const keep = 1; // padding line that makes the diff long enough\n'; let d = 'diff --git a/drafts/fringe/sensory-substitution-7.html b/drafts/fringe/sensory-substitution-7.html\n';
  while (d.length < MODEL_CODE_MAX - 60) d += pad;
  return d + '+' + FLASH + '\n' + pad.repeat(40);
};

test('a long diff is shortened for the model at a line boundary with a note; nothing is cut in half', () => {
  const { text, clipped } = clipForModel(longDiff());
  assert.ok(clipped); assert.ok(text.length <= MODEL_CODE_MAX + 120);
  assert.match(text, /\n\[\d+ more lines of this change not shown here: shortened to fit, not cut off\]$/);
  const lines = text.split('\n'); assert.ok(lines.slice(0, -1).every((l) => l.startsWith('+') || l.startsWith('diff ')), 'every line kept is whole');
  assert.equal(clipForModel('short').clipped, false);
});

test('closer read on #262\'s long diff: the clip rule goes to the model, its "cut off" finding is dropped, its real finding stays', async () => {
  const calls = []; const env = await envWith({ ai: ai(READ_262, calls) }); env.READ_TOKEN = 'owner-secret-0123456789';
  const r = await (await call(api.onRequestPost, env, { diff: longDiff() }, env.READ_TOKEN)).json();
  const user = calls[0].messages[1].content;
  assert.ok(user.includes(CLIP_RULE) && /not shown here: shortened to fit, not cut off\]\n```$/.test(user), 'the rule and the note');
  assert.doesNotMatch(r.answer, /truncated|cut off/);
  assert.match(r.answer, /style — `keep` is recomputed on every addition; keep a running map\. — `const keep = 1;/);
  assert.deepEqual([r.quoted.kept, r.quoted.parsed], [1, true]);
});

test('a cut-off claim about code that was not shortened is kept: only a clipped input silences it', async () => {
  assert.match(dropPhantoms(READ_262_PROSE, new Set(), FLASH, false), /truncated/);
  assert.doesNotMatch(dropPhantoms(READ_262_PROSE, new Set(), FLASH, true), /truncated/);
  const calls = []; const env = await envWith({ ai: ai(READ_262, calls) }); env.READ_TOKEN = 'owner-secret-0123456789';
  const r = await (await call(api.onRequestPost, env, { diff: 'diff --git a/drafts/fringe/sensory-substitution-7.html b/drafts/fringe/sensory-substitution-7.html\n+' + FLASH + '\n' }, env.READ_TOKEN)).json();
  assert.ok(!calls[0].messages[1].content.includes(CLIP_RULE));
  assert.match(r.answer, /truncated/);
});

const QUOTE_DIFF = 'diff --git a/lib/q.js b/lib/q.js\n--- a/lib/q.js\n+++ b/lib/q.js\n@@ -20,3 +20,6 @@\n async function load(rows) {\n+  for (const r of rows) { const n = await db.prepare(\'SELECT COUNT(*) FROM t\').first(); }\n+  const v = JSON.parse(raw).filter(Boolean);\n+  return v;\n }\n';
test('the closer read answers JSON: a stand-in model that invents a line sees its finding dropped, one that quotes a real line keeps it (with the line number taken from the quote), and the summary is built by code', async () => {
  const invented = JSON.stringify({ findings: [
    { file: 'lib/q.js', line: 21, kind: 'bug', text: '`rows` is reassigned inside the loop, so the second pass sees nothing.', quote: 'rows = rows.slice(1);' },
    { file: 'lib/q.js', line: 60, kind: 'bug', text: 'the parse is unguarded', quote: 'const v = JSON.parse(raw).filter(Boolean);' },
    { file: 'lib/q.js', line: 22, kind: 'risk', text: 'a query runs inside the loop', quote: '' },
    { file: 'lib/other.js', line: 5, kind: 'bug', text: 'the handler never awaits', quote: 'handle();' },
  ] }) + '\n\nTwo things to fix: guard the parse and move the query out of the loop.';
  const calls = []; const env = await envWith({ ai: ai(invented, calls) }); env.READ_TOKEN = 'owner-secret-0123456789';
  const r = await (await call(api.onRequestPost, env, { diff: QUOTE_DIFF }, env.READ_TOKEN)).json();
  assert.equal(r.review, 'model');
  assert.doesNotMatch(r.answer, /rows\.slice|reassigned/, 'the invented line is gone');
  assert.doesNotMatch(r.answer, /other\.js|never awaits/, 'a file not in the diff is gone');
  assert.doesNotMatch(r.answer, /query runs inside/, 'a finding with no quote is gone');
  assert.doesNotMatch(r.answer, /Two things to fix/, 'the model\'s prose never reaches the reader');
  assert.match(r.answer, /^lib\/q\.js:22 — bug — the parse is unguarded\. — `const v = JSON\.parse\(raw\)\.filter\(Boolean\);`\n\n1 finding, each quoting its line: 1 bug\.$/, 'the real finding stays, its line taken from the quote, the summary from code');
  assert.deepEqual(r.quoted, { kept: 1, dropped: 3, parsed: true, echoes: 0, refuted: 0 });
});

test('nothing parseable is none; fences, a bare array and prose around the JSON are tolerated; echoes of the shape are counted and dropped', async () => {
  const env = await envWith({ ai: ai('I have reviewed the diff. The code is fine, no bugs.') }); env.READ_TOKEN = 'owner-secret-0123456789';
  const r = await (await call(api.onRequestPost, env, { diff: QUOTE_DIFF }, env.READ_TOKEN)).json();
  assert.equal(r.answer, 'Nothing to report on a closer read.');
  assert.deepEqual(r.quoted, { kept: 0, dropped: 0, parsed: false, echoes: 0, refuted: 0 });
  assert.equal(parseFindingsJson('```json\n{"findings":[]}\n```').length, 0);
  assert.equal(parseFindingsJson('Here you go: [{"file":"a","line":1,"kind":"bug","text":"t","quote":"q"}] hope it helps').length, 1);
  assert.equal(parseFindingsJson('{"findings": "none"}'), null);
  assert.equal(parseFindingsJson(''), null);
  const ev = evidenceLines(QUOTE_DIFF, true);
  const v = validateFindings([
    { file: 'file:line', line: 1, kind: 'bug', text: 'one plain sentence on what is wrong', quote: 'the code line copied exactly' },
    { file: 'lib/x.js', line: 42, kind: 'bug', text: 'The parse is unguarded, so bad JSON throws here.', quote: 'const v = JSON.parse(raw);' },
    { file: '', line: 0, kind: 'performance', text: 'a query runs inside the loop', quote: "const n = await db.prepare('SELECT COUNT(*) FROM t').first();" },
    { file: 'q.js', line: 21, kind: 'risk', text: 'a query runs inside the loop', quote: "const n = await db.prepare('SELECT COUNT(*) FROM t').first();" },
  ], ev);
  assert.equal(v.echoes, 1); assert.equal(v.dropped, 3, 'the echo, the example line that is not in this code, and the repeat');
  assert.deepEqual(v.kept.map((f) => [f.file, f.line, f.kind]), [['lib/q.js', 21, 'risk']], 'placed by its quote, kind folded to risk');
  assert.equal(renderFindings([]), 'Nothing to report on a closer read.');
});

test('quoteCheck on its own: the shape it reads, pasted code by line number, a short quote must match a whole line, and "none"', () => {
  assert.deepEqual(parseFinding('* **lib/q.js:21** - risk - A query runs inside the loop. - `const n = await db.prepare(\'SELECT COUNT(*) FROM t\').first();`'),
    { file: 'lib/q.js', line: 21, kind: 'risk', sentence: 'A query runs inside the loop.', quote: "const n = await db.prepare('SELECT COUNT(*) FROM t').first();" });
  assert.equal(parseFinding('The provided diff is fine - really - yes'), null);
  assert.equal(parseFinding('### Bugs'), null);
  const ev = evidenceLines(QUOTE_DIFF, true);
  assert.deepEqual(ev['lib/q.js'].map(([n]) => n), [20, 21, 22, 23, 24]);
  assert.equal(ev['lib/q.js'][1][1], "  for (const r of rows) { const n = await db.prepare('SELECT COUNT(*) FROM t').first(); }");
  const q1 = quoteCheck('line 2 — bug — unguarded parse. — `JSON.parse(raw)`\nline 9 — style — short. — `}`\n\nFine otherwise.', evidenceLines('const a = 1;\nconst v = JSON.parse(raw);\nrun();\n}', false));
  assert.equal(q1.kept, 2); assert.equal(q1.dropped, 0);
  assert.match(q1.text, /^line 4 — style — short\. — `}`/m, 'a one-character quote matches only a whole line, and the number follows it');
  assert.deepEqual(quoteCheck('none', ev), { text: 'Nothing to report on a closer read.', kept: 0, dropped: 0 });
  const q2 = quoteCheck('lib/q.js:21 — bug — invented. — `nothing like this`', ev);
  assert.equal(q2.kept, 0); assert.equal(q2.dropped, 1); assert.match(q2.text, /could quote from the code: 1 claim about lines not in it was dropped/);
  assert.equal(quoteCheck('### Bugs\n\nProse only, the old shape, with no finding lines.', ev).text, '### Bugs\n\nProse only, the old shape, with no finding lines.');
  // what the live model did on 2026-10-10: the literal placeholder, the shape echoed back, "file:line — none"
  const q3 = quoteCheck('file:line — bug — the parse is unguarded. — `  const v = JSON.parse(raw).filter(Boolean);`\nfile:line — kind — one sentence — `the code line, quoted exactly as it appears`\nfile:line — none\n\nThe code is fine.', ev);
  assert.equal(q3.kept, 1); assert.equal(q3.dropped, 0);
  assert.match(q3.text, /^lib\/q\.js:22 — bug — the parse is unguarded\./m, 'a literal file:line is placed by its quote');
  assert.doesNotMatch(q3.text, /file:line|one sentence/, 'the echoed shape and the placeholder are gone');
  assert.equal(quoteCheck('file:line — none\n\nThe code is fine.', ev).text, 'Nothing to report on a closer read.');
  assert.equal(quoteCheck('lib/jobs.js:42 — bug — The parse is unguarded, so bad JSON throws here. — `const v = JSON.parse(raw);`', ev).kept, 0, 'the prompt\'s own example is not a finding about this code');
  assert.match(JSON_RULE, /Answer with JSON only/);
});

test('a bearer that is not the owner: the answer is the free tier with no reason, and the exact reason goes to the function log only, never the token', async () => {
  const lines = [], orig = console.log; console.log = (...a) => lines.push(a.join(' '));
  try {
    const env = await envWith({ ai: ai('never called') }); // no READ_TOKEN on this deployment
    let r = await (await call(api.onRequestPost, env, { code: BUGGY }, 'wrong-owner-key-0123456789')).json();
    assert.equal(r.tier, 'free'); assert.equal(r.review, 'rules'); assert.ok(!r.note || !/READ_TOKEN|differs|unset/.test(r.note), 'the answer carries no reason');
    assert.ok(lines.some((l) => /closer read access/.test(l) && /READ_TOKEN is not set/.test(l)), 'unset: said in the log');
    env.READ_TOKEN = 'the-real-owner-key-0123456789';
    r = await (await call(api.onRequestPost, env, { code: BUGGY }, 'wrong-owner-key-0123456789')).json();
    assert.equal(r.tier, 'free');
    assert.ok(lines.some((l) => /closer read access/.test(l) && /differs/.test(l)), 'differing: said in the log');
    assert.ok(lines.every((l) => !l.includes('wrong-owner-key') && !l.includes('the-real-owner-key')), 'no token in the log');
    assert.ok(!JSON.stringify(r).includes('differs') && !JSON.stringify(r).includes('READ_TOKEN'), 'no reason in the answer');
  } finally { console.log = orig; }
});

test('standard CSS is never a finding: #522 and #525\'s false claims about rotate and translate are dropped; real bugs on the same lines stay', () => {
  const diff = ['diff --git a/void-live-deploy/skills/sticky.js b/void-live-deploy/skills/sticky.js', '+++ b/void-live-deploy/skills/sticky.js', '@@ -86,0 +89,2 @@',
    "+  el.style.rotate = tiltOf(th.id) + 'deg'; // a real note never sits square; each keeps its own tilt",
    "+  el._aside = move; el.style.translate = away ? Math.round(move[0]) + 'px ' + Math.round(move[1]) + 'px' : '';"].join('\n');
  const ev = evidenceLines(diff, true);
  const v = validateFindings([
    { file: 'void-live-deploy/skills/sticky.js', line: 89, kind: 'bug', text: 'Using el.style.rotate is not a standard CSS property, so the tilt will not be applied in most browsers.', quote: "el.style.rotate = tiltOf(th.id) + 'deg'; // a real note never sits square; each keeps its own tilt" },
    { file: 'void-live-deploy/skills/sticky.js', line: 90, kind: 'bug', text: 'Using the non\u2011standard "style.translate" property may not be supported in many browsers, causing the element not to move as expected.', quote: "el._aside = move; el.style.translate = away ? Math.round(move[0]) + 'px ' + Math.round(move[1]) + 'px' : '';" },
    { file: 'void-live-deploy/skills/sticky.js', line: 89, kind: 'bug', text: 'tiltOf can return NaN for an empty id, so rotate gets "NaNdeg".', quote: "el.style.rotate = tiltOf(th.id) + 'deg'; // a real note never sits square; each keeps its own tilt" },
  ], ev);
  assert.deepEqual(v.kept.map((f) => f.text), ['tiltOf can return NaN for an empty id, so rotate gets "NaNdeg".'], 'only the real one stays');
  assert.equal(v.dropped, 2);
  assert.ok(knownFalse('CSS property "translate" is not a valid transitionable property; the intended effect (smooth glide) will not work.'), "#525's other claim");
  assert.equal(knownFalse('The scale factor is invalid when width is 0'), null, 'a scale that is not CSS is not this');
  assert.equal(knownFalse('The CSS property scale is set twice, the second overrides the first'), null, 'a real CSS finding stays');
  assert.match(CSS_RULE, /rotate, translate and scale/);
});
test('a line marked "void-review: ok" is left out of the closer read too, as the quick checks leave it out (#538\'s ReDoS claim on a marked line)', () => {
  const diff = ['diff --git a/tools/review-bench.mjs b/tools/review-bench.mjs', '+++ b/tools/review-bench.mjs', '@@ -0,0 +21,2 @@',
    "+  const re = new RegExp(quote); // void-review: ok (the pattern is a case written in tools/review-bench.json, meant as a regex)",
    "+  const r2 = new RegExp(userText);"].join('\n');
  const ev = evidenceLines(diff, true);
  const v = validateFindings([
    { file: 'tools/review-bench.mjs', line: 21, kind: 'risk', text: 'Building a RegExp directly from external data can cause ReDoS.', quote: 'const re = new RegExp(quote); // void-review: ok (the pattern is a case written in tools/review-bench.json, meant as a regex)' },
    { file: 'tools/review-bench.mjs', line: 22, kind: 'risk', text: 'Building a RegExp from user text can cause ReDoS.', quote: 'const r2 = new RegExp(userText);' },
  ], ev);
  assert.deepEqual(v.kept.map((f) => f.line), [22], 'the unmarked line stays');
  assert.equal(v.dropped, 1);
});
test('the closer read gets the widest diff that fits, file by file: narrowest first, then widened cheapest first while it fits', () => {
  const v = (n, c) => [c.repeat(n * 3), c.repeat(n * 2), c.repeat(n)]; // whole functions, 10 lines, 3 lines
  assert.equal(widestDiff([v(10, 'a')], 100), 'a'.repeat(30), 'one small file: its whole functions');
  assert.equal(widestDiff([v(10, 'a'), v(30, 'b')], 70).length, 30 + 1 + 30, 'the cheap file widens fully (30), the big one stays at 3 lines (30)');
  assert.equal(widestDiff([v(10, 'a'), v(30, 'b')], 200), 'a'.repeat(30) + '\n' + 'b'.repeat(90), 'room for both: both whole');
  // nothing fits: the 3-line views, shortened at a line boundary with the note, never cut inside a line (#549: a hard cut at
  // 12,000 characters ended the diff on "addEventListener('clic" and the closer read called the line truncated)
  const lines = (n, c) => Array.from({ length: n }, (_, i) => c + i + ' ' + c.repeat(20)).join('\n');
  const cut = widestDiff([lines(8, 'a'), lines(8, 'b')], 200);
  assert.ok(cut.length <= 200, 'it fits: ' + cut.length);
  const shownLines = cut.split('\n'), note = shownLines.pop();
  assert.match(note, /^\[\d+ more lines? of this change not shown here: shortened to fit, not cut off\]$/);
  assert.ok(shownLines.length && shownLines.every((l) => (lines(8, 'a') + '\n' + lines(8, 'b')).split('\n').includes(l)), 'every line shown is whole');
  assert.equal(Number(note.match(/\d+/)[0]), 16 - shownLines.length, 'the note counts the lines left out');
  // and the model's side knows it was shortened: the clip rule goes with it and a "cut off" claim is dropped
  const shown = clipForModel(cut, 200);
  assert.deepEqual([shown.text, shown.clipped], [cut, true]);
  assert.equal(widestDiff([['', '', 'x']], 10), 'x', 'an empty view (a git error) is skipped');
  assert.equal(widestDiff([], 10), '');
});
test('the second pass drops a finding the code does not prove (#540: "r.deep is an object" when review-pr writes it as text) and keeps the rest', async () => {
  const code = "const findings = [...(r.findings || []), ...deepFindings(r.deep)];\nconst n = JSON.parse(text);";
  const first = { findings: [
    { file: '', line: 1, kind: 'bug', text: 'deepFindings is called with r.deep, an object, so it finds nothing.', quote: 'const findings = [...(r.findings || []), ...deepFindings(r.deep)];' },
    { file: '', line: 2, kind: 'bug', text: 'JSON.parse throws on bad text and nothing catches it.', quote: 'const n = JSON.parse(text);' }] };
  const calls = [];
  const env = (verdicts) => ({ AI: { run: async (_m, o) => { calls.push(o.messages); return { response: JSON.stringify(calls.length % 2 ? first : verdicts) }; } } });
  calls.length = 0;
  const d = await closerReadDetail(env({ verdicts: [{ n: 1, holds: false, why: 'what r.deep is depends on code not shown' }, { n: 2, holds: true }] }), { ask: 'review this code', code, lang: 'javascript', res: { findings: [] } });
  assert.equal(d.kept, 1); assert.equal(d.refuted, 1);
  assert.match(d.answer, /JSON\.parse throws/); assert.doesNotMatch(d.answer, /an object/);
  assert.match(calls[1][1].content, /1\. line 1 \(bug\): deepFindings is called/, 'the check sees each finding, numbered');
  assert.match(calls[1][1].content, /const n = JSON\.parse\(text\);/, 'and the code it was made from');
  // the check fails or says nothing usable: every finding stays
  calls.length = 0;
  const kept = await closerReadDetail({ AI: { run: async (_m, o) => { calls.push(1); if (calls.length > 1) throw new Error('busy'); return { response: JSON.stringify(first) }; } } }, { ask: 'review this code', code, lang: 'javascript', res: { findings: [] } });
  assert.equal(kept.kept, 2);
  assert.deepEqual(applyVerdicts([{ a: 1 }, { a: 2 }], 'no json here').kept.length, 2);
  assert.deepEqual(applyVerdicts([{ a: 1 }, { a: 2 }], { verdicts: [{ n: 2, holds: false }] }).kept, [{ a: 1 }]);
  assert.equal(verifyMessages([], 'x').length, 2);
});
test('a "never defined" claim that names a declared constant bare (not in backticks) is dropped (#541: CSS_RULE)', () => {
  const known = declaredNames("export const CSS_RULE = 'x';\nexport const MASK_RULE = 'y';");
  const claim = 'CSS_RULE is referenced but never defined or imported, causing a ReferenceError when verifyMessages runs. `return [{ role: \'system\', content: VERIFY_SYSTEM + MASK_RULE + CSS_RULE },`';
  assert.equal(dropPhantoms(claim, known, 'content: VERIFY_SYSTEM + MASK_RULE + CSS_RULE'), '');
  // a claim about a name that really is undeclared stays, and plain English words are never names
  assert.notEqual(dropPhantoms('RUN_CAP_DAY is never defined, so this throws. `if (n > RUN_CAP_DAY) stop();`', known, 'if (n > RUN_CAP_DAY) stop();'), '');
  assert.deepEqual(phantomNames('The Value is not defined here and Text is never imported.', declaredNames('const Value = 1, Text = 2;')), []);
});
test('the closer read gets one hop of related files: relative and site-root imports, and the server function behind an /api/ call', () => {
  const text = "import { a } from './watch-ui.js';\nimport { b } from '../lib/watch.js';\nconst m = await import('/lib/automation-fix.js');\nconst j = await fetch('/api/watch', { method: 'POST' });\nimport fs from 'node:fs';";
  assert.deepEqual(relatedPaths('void-live-deploy/skills/watch.js', text).sort(), ['void-live-deploy/functions/api/watch.js', 'void-live-deploy/lib/automation-fix.js', 'void-live-deploy/lib/watch.js', 'void-live-deploy/skills/watch-ui.js']);
  assert.deepEqual(relatedPaths('tools/x.mjs', "import { r } from '../void-live-deploy/lib/review-api.js';\nfetch('/api/review');"), ['void-live-deploy/lib/review-api.js'], 'outside the site: no /api/ mapping, no site-root imports');
  assert.deepEqual(relatedPaths('a.js', "import x from './a.js';"), [], 'never itself');
  assert.match(DIFF_RULE, /never review them/);
  // the changed file's own lines come first and are kept when the budget is short; a related file only gets what is left
  const own = Array.from({ length: 40 }, (_, i) => 'export const OWN_' + i + ' = ' + 'x'.repeat(80) + ';');
  const rel = Array.from({ length: 60 }, (_, i) => 'export const REL_' + i + ' = ' + 'y'.repeat(80) + ';');
  const c = cleanImports({ 'skills/watch.js': own, 'functions/api/watch.js': rel });
  assert.equal(c['skills/watch.js'].length, 40, 'every own line kept');
  assert.ok(!c['functions/api/watch.js'] || c['functions/api/watch.js'].length < 60);
});

// #590: the closer read said draw.js:122 "uses m[2] which is undefined"; the pattern is new RegExp('^(?:make|set) ' + L + ' (thicker|…)$')
// and L holds the first group, so m[2] is the second and right ("make sky thicker" gives 1.5). A group count it cannot see is not a bug.
test('a claim that a capture group is undefined, on a regex built from joined strings, is dropped; on a literal regex it stays (#590)', () => {
  const line = "  if ((m = new RegExp('^(?:make|set) ' + L + ' (thicker|fatter|bolder|thinner|slimmer|finer)$').exec(t))) return one('thick', m[1], { by: /thicker|fatter|bolder/.test(m[2]) ? 1.5 : 1 / 1.5 });";
  const claim = "The regex capture for thickness uses m[2] which is undefined, causing the 'by' factor to be wrong for thicker/fatter/bolder commands.";
  assert.ok(uncountedGroupClaim(claim, line), "#590's claim");
  assert.ok(uncountedGroupClaim('Capture group 3 does not exist in this pattern, so m[3] is always undefined.', "const re = new RegExp(`^${A} (x|y) ${B}$`);"), 'a template-built pattern');
  assert.ok(!uncountedGroupClaim('m[2] is undefined: the pattern has only one capture group.', 'const m = /^make (\\w+)$/.exec(t); use(m[2]);'), 'a literal regex can be counted: the claim stays');
  assert.ok(!uncountedGroupClaim('This regex is rebuilt on every call; hoist it.', line), 'another claim on the same line stays');
  const ev = evidenceLines(['diff --git a/void-live-deploy/skills/draw.js b/void-live-deploy/skills/draw.js', '+++ b/void-live-deploy/skills/draw.js', '@@ -0,0 +122,1 @@', '+' + line].join('\n'), true);
  const v = validateFindings([{ file: 'void-live-deploy/skills/draw.js', line: 122, kind: 'bug', text: claim, quote: line.trim() }], ev);
  assert.equal(v.kept.length, 0); assert.equal(v.dropped, 1);
  assert.match(REGEX_RULE, /new RegExp/);
});
