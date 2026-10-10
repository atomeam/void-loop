// Void's code review as a product (functions/api/review.js, the page at /code-review/, the GitHub Action in review/).
// Free: the instant checks (lib/code-review.js), for anyone, no account: findings with line numbers in milliseconds.
// Pro: a paid Void (the Gumroad membership, void_accounts.tier = 'paid') mints review keys; a request with one also gets
// the model's closer read (it confirms the real findings, drops wrong ones and adds what the patterns missed), up to
// PRO_DAILY a day per key. Keys look like "vr1.<43 chars>"; only their SHA-256 is stored, and the tier is read from the
// account on every call, so a refund or a cancelled membership turns a key back into a free one at once.
import { REVIEW_SYSTEM, ruleReview, findingsText, langNamed } from './code-review.js';
import { INJECTION_RULE, redact } from './automation-fix.js';

export const KEY_RE = /^vr1\.[A-Za-z0-9_-]{43}$/;
export const MAX_KEYS = 5, PRO_DAILY = 300, CODE_MAX = 60000, MODEL_CODE_MAX = 12000;
export const BUY_URL = 'https://a-to-mind.com/code-review/#pro';
import { models } from './models.js';
export const MODEL = models('review');

const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export const keyHash = async (key) => hex(await crypto.subtle.digest('SHA-256', enc.encode('void-review-key:' + key)));
export function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return 'vr1.' + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const keyFrom = (request) => { const m = /^Bearer (\S+)$/.exec(request.headers.get('authorization') || ''); return m && KEY_RE.test(m[1]) ? m[1] : null; };
export const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

// The instant checks on pasted code (or, for a diff, on its added lines only, so the findings are about what changed).
export function quick(body) {
  const t0 = Date.now();
  let code = String(body.code || body.diff || '').replace(/\r\n?/g, '\n').slice(0, CODE_MAX);
  const lang = body.lang || langNamed(String(body.ask || '')) || undefined;
  let lines = null;
  if (body.diff) { // keep the added lines, remembering where each one was in the new file
    lines = []; let at = 0; const keep = [];
    for (const l of code.split('\n')) {
      const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/); if (h) { at = +h[1]; continue; }
      if (/^(?:\+\+\+|---|diff |index )/.test(l)) continue;
      if (l.startsWith('+')) { keep.push(l.slice(1)); lines.push(at++); } else if (!l.startsWith('-')) at++;
    }
    code = keep.join('\n');
  }
  const res = ruleReview(code, { lang, max: 200 });
  const findings = res.findings.map(({ line, kind, rule, message }) => ({ line: lines ? lines[line - 1] || line : line, kind, rule, message }));
  return { lang: res.lang, findings, lines: res.lines, ms: Date.now() - t0, res, code: body.diff ? String(body.diff).slice(0, CODE_MAX) : code };
}

// What a diff review cannot see, and the two false findings it makes without it (2026-10-10, after #254 and #256): a name declared
// outside the hunk (an import at the top, a helper above), and "[redacted]", the mask redact() puts over a secret before the model
// reads the code. tools/review-pr.mjs sends each touched file's import and top-level declaration lines as `imports` ({ path: [lines] });
// the prompt names them and the mask; and dropPhantoms() takes out such a claim when the model makes it anyway, so a wrong
// "not defined" never reaches the PR. tools/review-learn.mjs counts the same claims in past reviews with the same functions.
export const DIFF_RULE = 'This is a pull request diff: review the added lines (+), using the rest as context. You see only part of each file: a name used in the diff but declared elsewhere in the file (an import at the top, a helper above or below the hunk) is not missing; the imports and top-level declarations of each touched file are listed below. Never report a missing import, an undefined name or a ReferenceError from a diff.';
export const MASK_RULE = '"[redacted]" marks a secret that was masked before you saw the code; it is not in the file. Never report it as a value, a syntax error or a bug.';
export const IMPORTS_MAX = 6000; // characters of import and declaration lines the prompt may carry, over all files
// { path: [lines] } from the request, capped and stringified; null when there is nothing usable
export function cleanImports(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const out = {}; let total = 0;
  for (const [f, ls] of Object.entries(x).slice(0, 40)) {
    const lines = (Array.isArray(ls) ? ls : []).map((l) => String(l).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim()).filter(Boolean).slice(0, 60);
    const kept = []; for (const l of lines) { const t = l.slice(0, 300); if (total + t.length > IMPORTS_MAX) break; total += t.length; kept.push(t); }
    if (kept.length) out[String(f).slice(0, 200)] = kept;
  }
  return Object.keys(out).length ? out : null;
}
export function importsText(imports) {
  const im = cleanImports(imports); if (!im) return '';
  return 'What each touched file imports or declares at top level (outside the diff):\n' + Object.entries(im).map(([f, ls]) => f + ':\n' + ls.map((l) => '  ' + l).join('\n')).join('\n');
}
// the identifiers a stretch of code declares or imports (JavaScript, TypeScript, Python); a Set of local names
export function declaredNames(text) {
  const t = String(text || ''), names = new Set();
  // one name per comma: "a", "b as c" (import), "b: c" (destructuring rename), "d = 1" (default), "...rest"
  const add = (s) => { for (const n0 of String(s || '').split(',')) { const n = n0.replace(/=.*$/, '').replace(/^\s*\.\.\./, '').trim(); const m = (n.includes(':') ? n.slice(n.indexOf(':') + 1) : n.replace(/^[\w$.]+\s+as\s+/, '')).trim().match(/^([A-Za-z_$][\w$]*)/); if (m) names.add(m[1]); } };
  for (const m of t.matchAll(/\bimport\s+(?:type\s+)?([A-Za-z_$][\w$]*)?\s*,?\s*(?:\*\s+as\s+([A-Za-z_$][\w$]*))?\s*(?:\{([^}]*)\})?\s*from\b/g)) { if (m[1]) names.add(m[1]); if (m[2]) names.add(m[2]); add(m[3]); }
  for (const m of t.matchAll(/\b(?:const|let|var)\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s*=\s*(?:await\s+)?(?:require|import)\s*\(/g)) { add(m[1]); if (m[2]) names.add(m[2]); }
  for (const m of t.matchAll(/\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of t.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of t.matchAll(/\b(?:const|let|var)\s+(?:\{([^}]*)\}|\[([^\]]*)\]|([A-Za-z_$][\w$]*))/g)) { add(m[1]); add(m[2]); if (m[3]) names.add(m[3]); }
  for (const m of t.matchAll(/^\s*from\s+\S+\s+import\s+([^\n#]+)/gm)) add(m[1].replace(/[()]/g, ''));
  for (const m of t.matchAll(/^\s*import\s+([\w.]+)(?:\s+as\s+(\w+))?\s*$/gm)) names.add(m[2] || m[1].split('.')[0]);
  for (const m of t.matchAll(/^\s*(?:def|class)\s+(\w+)/gm)) names.add(m[1]);
  for (const m of t.matchAll(/^([A-Za-z_]\w*)\s*(?::\s*\w+)?\s*=\s*/gm)) names.add(m[1]);
  return names;
}
// a claim that something is missing: "not defined", "not imported", "ReferenceError", "missing import", "is undefined" …
export const PHANTOM_RE = /\b(?:not\s+(?:defined|imported|declared|in\s+scope)|never\s+(?:defined|imported|declared)|isn't\s+(?:defined|imported|declared)|undefined\s+(?:variable|name|function|identifier|reference)|ReferenceError|missing\s+(?:an?\s+)?import|is\s+undefined|will\s+be\s+undefined|no\s+import\s+(?:for|of))\b/i;
// a claim about the mask itself: "[redacted]" called a value, a syntax error, a placeholder or a bug
export const MASK_CLAIM_RE = /\[redacted\]/;
const MASK_WORDS = /\b(?:ReferenceError|SyntaxError|not\s+(?:a\s+)?valid|invalid|undefined|placeholder|bug|error|crash|fail|broken|typo|literal)\b/i;
const KEYWORDS = new Set('try catch finally if else for while do switch case break continue return const let var function class new this super import export from as default null undefined true false await async yield typeof instanceof in of delete void throw with static get set'.split(' '));
const GLOBALS = new Set('window document globalThis self console process fetch navigator localStorage sessionStorage addEventListener removeEventListener setTimeout clearTimeout setInterval clearInterval requestAnimationFrame queueMicrotask JSON Math Date Promise Response Request URL URLSearchParams crypto caches Object Array String Number Boolean Error TypeError Map Set Symbol RegExp Intl TextEncoder TextDecoder Buffer require module exports'.split(' '));
// the identifiers a paragraph puts in backticks, file names (`answer.js`), keywords and globals left out
const tick = (p) => [...new Set([...String(p).matchAll(/`([A-Za-z_$][\w$]*)((?:\.[\w$]+)*)(?:\([^`]*\))?`/g)].filter((m) => !/\.(?:m?js|cjs|tsx?|jsx|py|json|md|html|css|yml|yaml|sh)$/i.test(m[2])).map((m) => m[1]))].filter((n) => !KEYWORDS.has(n) && !GLOBALS.has(n));
const bareIn = (code, n) => new RegExp('(?<![.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:)').test(code);
/** the known names a paragraph claims are missing (empty when it makes no such claim); 'mask' when it blames "[redacted]".
 * A paragraph that also names an undeclared identifier used as a bare value or call in the code may be a real finding: kept. */
export function phantomNames(paragraph, known, code = '') {
  const p = String(paragraph || ''), out = [];
  if (MASK_CLAIM_RE.test(p) && MASK_WORDS.test(p)) out.push('mask');
  if (PHANTOM_RE.test(p)) {
    const names = tick(p), declared = names.filter((n) => known && known.has(n));
    const suspect = names.some((n) => !(known && known.has(n)) && bareIn(code, n));
    if (declared.length && !suspect) out.push(...declared);
  }
  return out;
}
/** the closer read with its phantom findings taken out: a paragraph (a bullet with its fix) that claims a known name is missing, or
 * blames the mask, goes; a heading left with nothing under it goes with it */
// Code longer than MODEL_CODE_MAX is shortened for the model at a line boundary and ends with CLIP_NOTE, so the model never
// sees a line cut in half (on #262 a hard cut at 12,000 characters landed inside a draft's flash() and the closer read
// reported the function "cut off in the middle of a line"). CLIP_RULE tells the model; when it says so anyway, the
// paragraph goes (CUT_RE), but only when the code really was shortened.
export const CLIP_RULE = 'If the code ends with a line saying more lines are not shown, the rest was left out to fit: every line above it is complete. Never report code as truncated, cut off or incomplete because of where it ends.';
export const clipNote = (n) => '[' + n + ' more line' + (n === 1 ? '' : 's') + ' of this change not shown here: shortened to fit, not cut off]';
export function clipForModel(code, max = MODEL_CODE_MAX) {
  const s = String(code || '');
  if (s.length <= max) return { text: s, clipped: false };
  const at = s.lastIndexOf('\n', max), head = s.slice(0, at > 0 ? at : max);
  return { text: head + '\n' + clipNote(s.slice(head.length).split('\n').filter((l) => l.trim()).length), clipped: true };
}
const CUT_RE = /\b(?:truncated|cut[\s-]off|cut\s+short|incomplete\s+(?:line|function|statement|code)|ends\s+abruptly|mid-?line|in\s+the\s+middle\s+of\s+a\s+line|unterminated)\b/i;

export function dropPhantoms(answer, known, code = '', clipped = false) {
  const paras = String(answer || '').split(/\n[ \t]*\n/), kept = [];
  for (const p of paras) if (!phantomNames(p, known, code).length && !(clipped && CUT_RE.test(p))) kept.push(p);
  const out = [];
  for (let i = 0; i < kept.length; i++) {
    const isHead = /^\s*(?:#{1,6}\s|\*\*[^*\n]{2,60}\*\*\s*:?\s*$)/.test(kept[i]) && kept[i].trim().split('\n').length === 1;
    const nextHead = i + 1 >= kept.length || /^\s*(?:#{1,6}\s|\*\*[^*\n]{2,60}\*\*\s*:?\s*$|\*\*Not blocking|<sub>)/.test(kept[i + 1]);
    if (isHead && nextHead && kept.length !== paras.length) continue; // only when something was dropped
    out.push(kept[i]);
  }
  return out.join('\n\n').trim();
}

// The closer read must quote its evidence (2026-10-10). Every false claim it made tonight (#254, #256, #262, #270, #325) was about
// code the model had not seen: a name declared outside the hunk, the mask, a line it miscounted. So the prompt asks for the findings
// in one checkable shape, one per line, each ending with the code line quoted, and quoteCheck() drops any finding whose quote is not
// in the code shown at that file (the pasted code, or the diff's lines of that file). A finding with no quote is dropped the same way.
// The prose after the list stays for the person. tools/review-learn.mjs reads the same shape back (parseFinding).
export const QUOTE_RULE = 'Answer in two parts. First the findings, one per line, each in this shape and nothing else on the line: the file and new-file line number as the diff shows them (for pasted code just the line number), then the kind (bug, risk or style), then one sentence, then the code line copied character for character from the code shown, in backticks, the four joined by " — ". '
  + 'For example (never copy this example, it is not about this code): lib/jobs.js:42 — bug — The parse is unguarded, so bad JSON throws here. — `const v = JSON.parse(raw);` '
  + 'A finding whose line you cannot quote from the code shown is not a finding: leave it out. Write the single word none when there is nothing to report. '
  + 'Then one blank line and a short plain summary for the person with the fix for each finding, and nothing in it that is not in the list: a problem that is not worth a quoted line is not worth a sentence either.';
// the shape as the first prompt wrote it; a model echoes it now and then, and an echo is not a finding
const TEMPLATE_QUOTE = /^the code line, quoted exactly as it appears$/i, EXAMPLE_QUOTE = /^const v = JSON\.parse\(raw\);$/;
const KINDS = new Set(['bug', 'risk', 'style', 'security', 'performance', 'readability', 'note', 'nit']);
const SEP = /\s+[—–]\s+|\s+-\s+|\s*—\s*/;
/** one line of the answer as a finding: { file, line, kind, sentence, quote } or null. The quote is the trailing backticked span. */
export function parseFinding(text) {
  const line = String(text || '').trim(); if (!line || line.length > 1200) return null;
  const parts = line.split(SEP).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const loc = parts[0].replace(/^[\s*\-•>]+|^\d+[.)]\s+/g, '').replace(/^\*\*|\*\*$/g, '').replace(/`/g, '').trim();
  // "file:line" written literally (the model kept the placeholder) is a finding with no place: the quote alone has to place it
  const lm = /^file:line$/i.test(loc) ? [loc, '', '0'] : loc.match(/^(?:([\w./\\-]+?):)?\s*(?:line\s+)?L?(\d{1,6})\s*:?$/i); if (!lm) return null;
  const kind = parts[1].replace(/\*/g, '').toLowerCase().replace(/^\((.*)\)$/, '$1').trim();
  if (!KINDS.has(kind)) return null;
  const last = parts[parts.length - 1], qm = parts.length > 3 ? last.match(/^`([^`]+)`\.?$/) : null;
  const sentence = (qm ? parts.slice(2, -1) : parts.slice(2)).join(' — ').replace(/\*\*/g, '').trim();
  return { file: lm[1] || '', line: +lm[2], kind, sentence, quote: qm ? qm[1] : null };
}
/** the code the model saw, as { file: [[line, text], …] } ('' for pasted code); the diff's new-file numbering for a diff */
export function evidenceLines(code, isDiff) {
  const out = { '': [] }, rows = String(code || '').split('\n');
  if (rows.length && rows[rows.length - 1] === '') rows.pop(); // the newline that ends the text is not a line
  if (!isDiff) { out[''] = rows.map((t, i) => [i + 1, t]); return out; }
  let file = '', n = 1;
  for (const l of rows) {
    const g = l.match(/^diff --git a\/(?:.+?) b\/(.+)$/) || l.match(/^\+\+\+ b\/(.+)$/); if (g) { file = g[1]; out[file] = out[file] || []; continue; }
    if (/^(?:index |--- )/.test(l)) continue;
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/); if (h) { n = +h[1]; continue; }
    if (l.startsWith('-') || l.startsWith('\\')) continue;
    out[file].push([n, l.startsWith('+') || l.startsWith(' ') ? l.slice(1) : l]); n++;
  }
  return out;
}
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
/**
 * quoteCheck(answer, evidence) -> { text, kept, dropped }: every finding-shaped line is checked against the code; a quote found in
 * that file keeps the finding (its line number corrected when the quote sits elsewhere), a quote found nowhere or a finding with no
 * quote is dropped. Other lines (the summary) stay. Kept findings are separated by blank lines so each is its own paragraph.
 */
export function quoteCheck(answer, evidence) {
  const out = []; let kept = 0, dropped = 0;
  const files = Object.keys(evidence || {});
  for (const raw of String(answer || '').split('\n')) {
    // "none" (alone, or after a literal file:line) and an echo of the shape itself are not findings and not claims: they go, uncounted
    if (/^[\s*\-•>]*(?:file:line\s*[—–-]+\s*)?none\.?\s*$/i.test(raw) || /\bfile:line\b.*[—–-]\s*kind\s*[—–-].*one sentence/i.test(raw)) continue;
    const f = parseFinding(raw);
    if (!f) { out.push(raw); continue; }
    if (!f.quote || !norm(f.quote)) { dropped++; continue; } // no quote, no finding
    if (TEMPLATE_QUOTE.test(f.quote.trim()) || EXAMPLE_QUOTE.test(f.quote.trim()) && !files.some((k) => (evidence[k] || []).some(([, t]) => norm(t) === norm(f.quote)))) { dropped++; continue; } // the shape or the example echoed back
    const q = norm(f.quote), exact = q.length < 8;
    const match = ([, t]) => { const n = norm(t); return exact ? n === q : n.includes(q) || (n.length >= 8 && q.includes(n)); };
    const placeless = !f.file && !f.line; // a literal file:line: the quote decides the file
    let ev = placeless ? null : evidence[f.file]; if (!ev && f.file) { const k = files.find((x) => x && (x.endsWith('/' + f.file) || f.file.endsWith('/' + x) || x.split('/').pop() === f.file.split('/').pop())); ev = k ? evidence[k] : null; }
    if (!ev && !f.file && !placeless) ev = files.length === 2 && evidence[''].length === 0 ? evidence[files[1]] : evidence['']; // pasted code, or a one-file diff named by line only
    let hits = ev ? ev.filter(match) : [], inFile = f.file;
    if (!hits.length && placeless) for (const k of files) { const h = (evidence[k] || []).filter(match); if (h.length) { hits = h; inFile = k; break; } }
    if (!hits.length) { dropped++; continue; }
    kept++;
    const locRe = /(^[\s*\-•>]*(?:\d+[.)]\s+)?`?)((?:[\w./\\-]+?:)?\s*(?:line\s+)?L?\d{1,6}|file:line)/i;
    if (placeless) { out.push('', raw.trim().replace(locRe, '$1' + (inFile ? inFile + ':' : 'line ') + hits[0][0]), ''); continue; } // the place the quote gave it
    if (hits.some(([n]) => Math.abs(n - f.line) <= 3)) { out.push('', raw.trim(), ''); continue; }
    const at = hits[0][0]; // the quote sits elsewhere: the line number is corrected, the finding stays
    out.push('', raw.trim().replace(/(^[\s*\-•>]*(?:\d+[.)]\s+)?`?(?:[\w./\\-]+?:)?\s*(?:line\s+)?L?)\d{1,6}/i, '$1' + at), '');
  }
  let text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (/^none\.?$/i.test(text) || (!text && !dropped) || (!kept && !dropped && /^(?:the code (?:is|looks) fine\.?|nothing to report\.?|looks good\.?)$/i.test(text))) text = 'Nothing to report on a closer read.';
  if (!text) text = 'Nothing the closer read could quote from the code: ' + dropped + ' claim' + (dropped === 1 ? ' about lines not in it was' : 's about lines not in it were') + ' dropped.';
  return { text, kept, dropped };
}

// The closer read by the model, told what the checks found. Keys are masked before the model sees anything. For a diff, the
// touched files' imports come along (DIFF_RULE) and phantom findings are taken out of the answer (dropPhantoms); then every finding
// must quote its line (QUOTE_RULE, quoteCheck). closerReadDetail -> { answer, kept, dropped }; closerRead -> the answer alone.
export async function closerReadDetail(env, { ask, code, lang, diff, res, imports }) {
  const im = importsText(imports), shown = clipForModel(redact(String(code || '')));
  const r = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: REVIEW_SYSTEM + ' ' + INJECTION_RULE + ' ' + MASK_RULE + ' ' + QUOTE_RULE },
      { role: 'user', content: 'What they asked: ' + redact(String(ask || 'review this code')).slice(0, 300) + '\nLanguage (guessed): ' + lang + (diff ? '\n' + DIFF_RULE : '') + (shown.clipped ? '\n' + CLIP_RULE : '') + '\n\nQuick checks found:\n' + findingsText(res) + (im ? '\n\n' + redact(im) : '') + '\n\nThe code (keys masked):\n```\n' + shown.text + '\n```' },
    ],
    max_tokens: 1400, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low',
  });
  const out = r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response));
  if (!out) return { answer: '', kept: 0, dropped: 0 };
  const known = declaredNames(String(code || '') + '\n' + im);
  // each finding line becomes its own paragraph first, so a phantom claim on one line never takes its neighbours with it
  const spaced = redact(String(out).trim()).split('\n').map((l) => (parseFinding(l) ? '\n' + l.trim() + '\n' : l)).join('\n').replace(/\n{3,}/g, '\n\n');
  const q = quoteCheck(dropPhantoms(spaced, known, String(code || '') + '\n' + im, shown.clipped), evidenceLines(shown.text, !!diff));
  return { answer: q.text, kept: q.kept, dropped: q.dropped };
}
export async function closerRead(env, opts) { return (await closerReadDetail(env, opts)).answer; }
