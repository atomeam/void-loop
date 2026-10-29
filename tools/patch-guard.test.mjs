// void-live-deploy/lib/patch-guard.js: model-written code is checked before it is saved, queued or shown as a fix. One test
// per way a model's code goes wrong (stub text, a lost half, code that does not parse, a lost function, an anchor that
// matches twice or never), a clean pass, and the Workers path where `new Function` is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardPatch, guardAnswer, applyPatch, syntaxError, scriptsOf, functionNames, stubReasons, heldBack } from '../void-live-deploy/lib/patch-guard.js';

const ORIGINAL = [
  'export function press(key) {',
  '  const out = key.trim();',
  '  return out.length ? out : null;',
  '}',
  'function logClick(e) { console.log("click", e && e.target); }',
  'const drain = async (q) => { while (q.length) await q.shift()(); };',
  'export const total = (xs) => xs.reduce((a, b) => a + b, 0);',
  '// keep the queue short: a long one means the page is behind',
  'export default { press, logClick, drain, total };',
].join('\n');

test('a clean rewrite passes, with the JavaScript parsed', () => {
  const after = ORIGINAL.replace('key.trim()', 'String(key || "").trim()');
  const r = guardPatch({ before: ORIGINAL, after, kind: 'js' });
  assert.deepEqual(r.reasons, []);
  assert.equal(r.ok, true);
  assert.equal(r.syntax, 'parsed');
});

test('stub text is rejected: "for brevity", "truncated", "rest of the code", "...existing code...", "// ..."', () => {
  const cases = {
    'for brevity': ORIGINAL + '\n// other helpers omitted for brevity',
    truncated: ORIGINAL + '\n/* (output truncated) */',
    'rest of the code': ORIGINAL + '\n// rest of the code stays as it was',
    'existing code': ORIGINAL.replace('function logClick', '// ...existing code...\nfunction logClick'),
    '// ...': ORIGINAL + '\n// ...',
  };
  for (const [name, after] of Object.entries(cases)) {
    const r = guardPatch({ before: ORIGINAL, after, kind: 'js' });
    assert.equal(r.ok, false, name);
    assert.ok(r.reasons.length >= 1, name);
  }
  assert.match(guardPatch({ before: ORIGINAL, after: cases['for brevity'], kind: 'js' }).reasons[0], /for brevity/);
  assert.match(guardPatch({ before: ORIGINAL, after: cases['existing code'], kind: 'js' }).reasons[0], /existing code/);
});

test('a marker the original already had is not a stub: a variable called truncated, an old "for brevity" comment', () => {
  const before = ORIGINAL + '\nconst truncated = (s) => s.slice(0, 9); // kept short for brevity';
  assert.equal(guardPatch({ before, after: before.replace('0, 9', '0, 12'), kind: 'js' }).ok, true);
  assert.deepEqual(stubReasons('const truncated = s.slice(0, 9);'), []); // a name, not a "(truncated)" note
});

test('a result that shrank by more than 30% is rejected; 25% shorter is fine', () => {
  const big = ORIGINAL + '\n' + Array.from({ length: 30 }, (_, i) => 'export const k' + i + ' = ' + i + ';').join('\n');
  const cut = big.slice(0, Math.floor(big.length * 0.6)).replace(/\n[^\n]*$/, '');
  const r = guardPatch({ before: big, after: cut, kind: 'text' });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /shorter than the original/);
  const trimmed = big.split('\n').slice(0, -8).join('\n'); // about a fifth shorter
  assert.ok(trimmed.length > big.length * 0.7);
  assert.equal(guardPatch({ before: big, after: trimmed, kind: 'text' }).ok, true);
});

test('JavaScript that does not parse is rejected, with the parser\'s words', () => {
  const r = guardPatch({ before: ORIGINAL, after: ORIGINAL.replace('return out.length ? out : null;', 'return out.length ? out : ;'), kind: 'js' });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /does not parse/);
  // modules parse: import, export and top-level await are fine
  assert.equal(syntaxError("import { x } from './x.js';\nexport const y = await x();\nexport default y;").error, null);
});

test('a function that disappeared is rejected by name', () => {
  const after = ORIGINAL.replace('function logClick(e) { console.log("click", e && e.target); }\n', '').replace('logClick, ', '');
  const r = guardPatch({ before: ORIGINAL, after, kind: 'js' });
  assert.equal(r.ok, false);
  assert.match(r.reasons.join(' '), /lost a function: logClick/);
  assert.deepEqual([...functionNames(ORIGINAL)].sort(), ['drain', 'logClick', 'press', 'total']);
});

test('html: inline <script> blocks are parsed, src and JSON scripts are skipped, lost functions count', () => {
  const page = '<!doctype html><html><body><p>hi</p>\n<script src="/a.js"></script>\n<script type="application/ld+json">{"a":1}</script>\n<script>\n' + ORIGINAL.replace(/export (default |const |function )?/g, (m, w) => (w === 'default ' ? 'window.api = ' : w || '')) + '\n</script>\n</body></html>';
  assert.equal(scriptsOf(page).length, 1);
  assert.equal(guardPatch({ before: page, after: page.replace('<p>hi</p>', '<p>hello</p>'), kind: 'html' }).ok, true);
  const broken = guardPatch({ before: page, after: page.replace('const out = key.trim();', 'const out = key.trim(;'), kind: 'html' });
  assert.equal(broken.ok, false);
  assert.match(broken.reasons.join(' '), /JavaScript does not parse/);
});

test('patch anchors: one that matches twice or never is rejected; a clean one applies', () => {
  const twice = guardPatch({ before: ORIGINAL, patch: { find: 'out', replace: 'res' }, kind: 'js' });
  assert.equal(twice.ok, false);
  assert.match(twice.reasons.join(' '), /ambiguous: its anchor "out" matches more than once/);
  const never = guardPatch({ before: ORIGINAL, patch: [{ find: 'function nowhere()', replace: 'x' }], kind: 'js' });
  assert.equal(never.ok, false);
  assert.match(never.reasons.join(' '), /points at text that is not there/);
  const clean = guardPatch({ before: ORIGINAL, patch: [{ find: 'key.trim()', replace: 'String(key).trim()' }], kind: 'js' });
  assert.equal(clean.ok, true, clean.reasons.join(' | '));
  assert.match(clean.after, /String\(key\)\.trim\(\)/);
  const stub = guardPatch({ before: ORIGINAL, patch: { find: 'const out = key.trim();', replace: '// ... rest of the function unchanged' }, kind: 'js' });
  assert.equal(stub.ok, false);
  assert.deepEqual(applyPatch('a', []).reasons, ['the patch has no changes in it']);
  assert.match(applyPatch('abc', [{ find: '', replace: 'x' }]).reasons[0], /empty anchor/);
});

test('json: a corrected config that does not parse is rejected; a fragment inside an answer may be an object\'s insides', () => {
  assert.equal(guardPatch({ after: '{"a": 1,}', kind: 'json' }).ok, false);
  assert.equal(guardPatch({ after: '"Content-Type": "application/json"', kind: 'json', fragment: true }).ok, true);
  assert.equal(guardPatch({ after: '"Content-Type": "application/json"', kind: 'json' }).ok, false);
});

test('an empty result is rejected', () => {
  assert.deepEqual(guardPatch({ before: ORIGINAL, after: '  ', kind: 'js' }).reasons, ['it is empty']);
});

test('guardAnswer: prose and every fenced block; the paste\'s own words do not count; a snippet may be a fragment', () => {
  const good = 'Likely cause: the header is missing.\nFix:\n1. Add it.\n```js\nheaders: { "content-type": "application/json" }\n```\n```yaml\non:\n  schedule:\n    - cron: "0 13 * * 1-5"\n```';
  assert.deepEqual(guardAnswer(good, { before: 'my webhook fails' }).reasons, []);
  const stub = 'Likely cause: x.\n```js\nfetch(url, opts);\n// ...existing code...\n```';
  const r = guardAnswer(stub, { before: 'my script fails' });
  assert.equal(r.ok, false);
  assert.match(r.reasons[0], /^the code block: it has a "...existing code..." placeholder/);
  const bad = guardAnswer('Fix:\n```javascript\nconst a = {;\n```', {});
  assert.equal(bad.ok, false);
  assert.match(bad.reasons[0], /does not parse/);
  // the person pasted a log that says "output truncated": the fix quoting it back is not a stub
  assert.equal(guardAnswer('Likely cause: the output truncated at 4 KB.\nFix:\n1. Raise the limit.', { before: 'error: output truncated' }).ok, true);
  assert.equal(guardAnswer('Fix: here is the list (truncated for space).', {}).ok, false);
  // prose may say "the rest of your config is fine"; inside a corrected config the same words are a stub
  assert.equal(guardAnswer('Likely cause: the token. The rest of your config is fine.', {}).ok, true);
  assert.equal(guardAnswer('Fix:\n```yaml\non: push\n# rest of your config unchanged\n```', {}).ok, false);
  assert.match(heldBack(['it is empty'], "the model's fix"), /^the model's fix was not used: it is empty$/);
});

test('without `new Function` (as on Workers) the bracket-and-string scan still catches broken code and passes good code', async () => {
  const { syntaxError: fresh } = await import('../void-live-deploy/lib/patch-guard.js?workers');
  const real = globalThis.Function;
  const blocked = function () { throw new EvalError('Code generation from strings disallowed for this context'); };
  // the guard reaches the constructor through an async function's prototype too
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor, proto = Object.getPrototypeOf(async function () {});
  const desc = Object.getOwnPropertyDescriptor(proto, 'constructor');
  globalThis.Function = blocked;
  Object.defineProperty(proto, 'constructor', { value: blocked, configurable: true, writable: true });
  try {
    const ok = fresh('const re = /[(]/g, s = `a ${ { b: 1 }.b } c`; // ) not real\nfunction f(x) { return x / 2 / (1 + 1); }');
    assert.deepEqual(ok, { error: null, how: 'brackets' });
    assert.match(fresh('function f() { return [1, 2; }').error, /closes a "\["/);
    assert.match(fresh('const s = "never ends;\nf();').error, /string never ends/);
    assert.match(fresh('if (a) { b();').error, /never closed/);
  } finally {
    globalThis.Function = real;
    Object.defineProperty(proto, 'constructor', desc);
  }
  assert.equal(AsyncFunction, Object.getPrototypeOf(async function () {}).constructor);
});
