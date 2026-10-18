// Verse's code review as a product (functions/api/review.js, the page at /code-review/, the GitHub Action in review/).
// Free: the instant checks (lib/code-review.js), for anyone, no account: findings with line numbers in milliseconds.
// Pro: a paid Verse (the Gumroad membership, void_accounts.tier = 'paid') mints review keys; a request with one also gets
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
export const DIFF_RULE = 'This is a pull request diff: review the added lines (+), using the rest as context. You see only part of each file: a name used in the diff but declared elsewhere in the file (an import at the top, a helper above or below the hunk) is not missing; the imports and top-level declarations of each touched file are listed below. Never report a missing import, an undefined name or a ReferenceError from a diff. Lines from related files (what the changed code imports, or the server function an /api/ call reaches) may come along under their own paths: read them to understand what a call takes and returns, never review them.';
/** the widest diff that fits the closer read, file by file. Each file gives its views widest first (its changes' whole functions,
 * then 10 lines around them, then 3); every file starts at its narrowest and is widened, cheapest first, while the whole still
 * fits. A reviewer that sees the whole function sees where a value comes from (the review bench's misses: a list read off an
 * answer that may have none, a flag shared across calls; none visible in 3 lines). Nothing fits even at 3: the 3-line views,
 * clipped, as before. Pure. */
export function widestDiff(files, max = MODEL_CODE_MAX) {
  const views = (files || []).map((v) => (Array.isArray(v) ? v : [v]).map((d) => String(d || '')).filter((d) => d.trim())).filter((v) => v.length);
  const at = views.map((v) => v.length - 1), size = () => views.reduce((n, v, i) => n + v[at[i]].length + (i ? 1 : 0), 0); // with the newlines that join them
  // nothing fits even at 3 lines: shortened at a line boundary with the note (clipForModel), never cut inside a line (#549)
  if (size() > max) { const all = views.map((v) => v[v.length - 1]).join('\n'); return clipForModel(all, max - clipNote(all.split('\n').length).length - 1).text; }
  for (let widened = true; widened;) {
    widened = false;
    const steps = views.map((v, i) => (at[i] > 0 ? { i, cost: v[at[i] - 1].length - v[at[i]].length } : null)).filter(Boolean).sort((a, b) => a.cost - b.cost);
    for (const st of steps) if (size() + st.cost <= max) { at[st.i]--; widened = true; break; }
  }
  return views.map((v, i) => v[at[i]]).join('\n');
}
export const MASK_RULE = '"[redacted]" marks a secret that was masked before you saw the code; it is not in the file. Never report it as a value, a syntax error or a bug.';
export const IMPORTS_MAX = 6000; // characters of import and declaration lines the prompt may carry, over all files
// { path: [lines] } from the request, capped and stringified; null when there is nothing usable
/** the files a changed file leans on, one hop: what it imports by relative or site path, and the server function behind each
 * /api/<name> it calls (a skill that reads /api/watch is shaped by functions/api/watch.js). The closer read gets their exported
 * names after the changed files' own lines, so it can see what a call returns without reviewing those files. Pure. */
export function relatedPaths(file, text) {
  const dir = String(file).split('/').slice(0, -1), out = new Set();
  const site = String(file).startsWith('void-live-deploy/') ? 'void-live-deploy' : '';
  const resolve = (spec) => {
    if (spec.startsWith('/')) return site ? site + spec : null; // a page or skill imports /lib/x.js from the site root
    const parts = [...dir];
    for (const seg of spec.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg); }
    return parts.join('/');
  };
  for (const m of String(text || '').matchAll(/\bfrom\s+['"]((?:\.{1,2})?\/[^'"\s]+)['"]|\bimport\s*\(\s*['"]((?:\.{1,2})?\/[^'"\s]+)['"]/g)) {
    const r = resolve(m[1] || m[2]); if (r && /\.m?js$/.test(r)) out.add(r);
  }
  if (site) for (const m of String(text || '').matchAll(/['"`]\/api\/([a-z0-9-]+)\b/g)) out.add(site + '/functions/api/' + m[1] + '.js');
  out.delete(file);
  return [...out];
}
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
    // the names in backticks, and the code-shaped words of the claim itself (CSS_RULE, closerReadDetail, $el: an underscore, a capital
    // or a $), since a JSON finding names them bare ("CSS_RULE is never defined", #541); plain English words are never taken for names
    const bare = [...p.split('`')[0].matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?![\w$])/g)].map((m) => m[1]).filter((n) => n.length > 2 && /[_$A-Z]/.test(n) && !/^[A-Z][a-z]+$/.test(n) && !KEYWORDS.has(n) && !GLOBALS.has(n));
    const names = [...new Set([...tick(p), ...bare])], declared = names.filter((n) => known && known.has(n));
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
const NOTE_RE = /\n\[\d+ more lines? of this change not shown here: shortened to fit, not cut off\]$/;
export function clipForModel(code, max = MODEL_CODE_MAX) {
  const s = String(code || '');
  if (s.length <= max) return { text: s, clipped: NOTE_RE.test(s) }; // already shortened by the sender (widestDiff): still clipped
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
// code the model had not seen: a name declared outside the hunk, the mask, a line it miscounted. A free model does not follow a text
// shape reliably either (it echoed the placeholder, ignored the list, wrote prose), so the prose channel is removed structurally: the
// model answers with JSON that matches FINDINGS_SCHEMA (Workers AI's JSON mode where the model supports it), every finding is validated
// against the code shown (the file is in the diff, the quote sits in that file, the line number is taken from the quote), and the text
// the person reads is built by code from the validated findings only. Nothing parseable means none. parseFinding and quoteCheck stay
// as a second layer behind the schema, and tools/review-learn.mjs reads the rendered lines back with parseFinding.
export const FINDINGS_SCHEMA = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object',
  properties: { file: { type: 'string' }, line: { type: 'integer' }, kind: { type: 'string', enum: ['bug', 'risk', 'style'] }, text: { type: 'string' }, quote: { type: 'string' } },
  required: ['file', 'line', 'kind', 'text', 'quote'] } } }, required: ['findings'] };
export const JSON_RULE = 'Answer with JSON only, no prose and no code fences, in exactly this shape: {"findings":[{"file":"lib/x.js","line":42,"kind":"bug","text":"one plain sentence on what is wrong and why it matters","quote":"the code line copied exactly"}]}. '
  + 'file and line are the file and the new-file line number as the diff shows them (for pasted code, file is ""). kind is bug, risk or style. '
  + 'quote is the whole code line the finding is about, copied character for character from the code shown: a finding whose line you cannot quote is not a finding, leave it out. '
  + 'Answer {"findings":[]} when there is nothing to report.';
const TEMPLATE_QUOTE = /^the code line,? (?:quoted exactly as it appears|copied exactly)$/i, PLACEHOLDER_TEXT = /^one (?:plain )?sentence\b/i, EXAMPLE_QUOTE = /^const v = JSON\.parse\(raw\);$/; // the shapes a model echoes back
/** the model's answer as a list of raw findings, or null when nothing in it parses as the shape (fences and stray prose around the JSON are tolerated) */
export function parseFindingsJson(text) {
  let t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const tryParse = (x) => { try { return JSON.parse(x); } catch (_) { return undefined; } };
  const listOf = (j) => (j && typeof j === 'object' ? (Array.isArray(j) ? j : Array.isArray(j.findings) ? j.findings : null) : null);
  let list = listOf(tryParse(t));
  // prose around the JSON: the outermost braces, then the outermost brackets, whichever holds the list
  if (!list) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) list = listOf(tryParse(t.slice(a, b + 1))); }
  if (!list) { const a = t.indexOf('['), b = t.lastIndexOf(']'); if (a >= 0 && b > a) list = listOf(tryParse(t.slice(a, b + 1))); }
  if (!list) return null;
  return list.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
}
const normKind = (k) => { k = String(k || '').toLowerCase().trim(); return k === 'bug' ? 'bug' : /^(risk|security|perf|performance|data)/.test(k) ? 'risk' : 'style'; };
const normQ = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const matchLine = (q) => { const exact = q.length < 8; return ([, t]) => { const n = normQ(t); return exact ? n === q : n.includes(q) || (n.length >= 8 && q.includes(n)); }; };
// Claims the free model keeps making about standard code (2026-10-11: #522's el.style.rotate and #525's translate were each called
// non-standard or not animatable). rotate, translate and scale are CSS Transforms Level 2 individual properties, standard and in every
// engine since 2022 (Chrome 104, Firefox 72, Safari 14.1), and they transition. The prompt says so (CSS_RULE) and a finding that
// still claims it is dropped like any other false claim, by code; a real bug on the same line (NaN, a missing unit) still stands.
export const CSS_RULE = 'The CSS properties rotate, translate and scale (and el.style.rotate, el.style.translate, el.style.scale) are standard individual transform properties in every current browser, and they can be transitioned and animated: never report them as non-standard, unsupported, invalid or not animatable.';
const NOT_STD = '(?:non[\\s\\-\\u2010-\\u2015]?standard|not\\s+(?:a\\s+)?(?:standard|valid)|unsupported|not\\s+(?:be\\s+)?supported|not\\s+transitionable|not\\s+animatable|cannot\\s+be\\s+(?:animated|transitioned))';
const PROP = '(?:\\b(?:style\\.)?(?:rotate|translate|scale)\\b)';
export const KNOWN_FALSE = [
  { re: new RegExp(PROP + '[\\s\\S]{0,120}' + NOT_STD + '|' + NOT_STD + '[\\s\\S]{0,120}' + PROP, 'i'), why: 'rotate/translate/scale are standard CSS (Transforms Level 2)' },
];
// A regex built from joined strings (new RegExp('^x ' + L + ' (a|b)$'), or a template) can hold capture groups inside its parts,
// so the model cannot count them: #590's closer read called draw.js's m[2] "undefined" where L carries the first group and m[2]
// is right. REGEX_RULE tells it; a claim that a capture group or index is undefined, on such a line, is dropped. A literal
// regex can be counted, and a claim about one stays.
export const REGEX_RULE = 'A regular expression built with new RegExp from joined strings or a template can hold capture groups inside the parts you do not see: never report a capture group or match index (m[1], m[2]) as undefined, missing or off by one on such a line.';
const GROUP_CLAIM = /\b(?:capture(?:\s+group)?s?|group\s*\d|m(?:atch)?\s*\[\s*\d+\s*\])/i, GROUP_WRONG = /\b(?:undefined|does\s?n[o']t\s+exist|do(?:es)?\s+not\s+exist|missing|off[- ]by[- ]one|wrong\s+(?:index|group)|no\s+such\s+group|only\s+(?:one|\d+)\s+(?:capture\s+)?groups?)\b/i;
export function uncountedGroupClaim(text, line) {
  const t = String(text || ''), l = String(line || '');
  return GROUP_CLAIM.test(t) && GROUP_WRONG.test(t) && /\bnew\s+RegExp\s*\(/.test(l) && /new\s+RegExp\s*\([\s\S]{0,200}?(?:['"`]\s*\+|\+\s*['"`]|\$\{)/.test(l);
}
// only a claim about CSS: "the scale factor is invalid when width is 0" is a real finding and stays
export const knownFalse = (text) => { const t = String(text || ''); return /\bcss\b|\bpropert(?:y|ies)\b|\bstyle\./i.test(t) ? KNOWN_FALSE.find((k) => k.re.test(t)) || null : null; };

/**
 * validateFindings(list, evidence) -> { kept: [{ file, line, kind, text, quote }], dropped, echoes }
 * A finding is kept only when its quote sits in the code shown, in the file it names (a basename matches; a finding naming no file is
 * placed by its quote), and its line number is taken from where the quote sits (the one nearest the line it named). An echo of the
 * prompt's shape, a placeholder, an empty quote or a quote found nowhere is dropped; a repeat of the same file, line and quote is one finding.
 */
export function validateFindings(list, evidence) {
  const kept = [], seen = new Set(); let dropped = 0, echoes = 0;
  const files = Object.keys(evidence || {}).filter((k) => k !== '' || (evidence[''] || []).length);
  for (const f of list || []) {
    const quote = normQ(f.quote), text = String(f.text || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!quote || !text) { dropped++; continue; }
    if (knownFalse(text)) { dropped++; continue; } // a claim about standard code the model keeps getting wrong (KNOWN_FALSE)
    if (TEMPLATE_QUOTE.test(quote) || PLACEHOLDER_TEXT.test(text) || /^file:line$/i.test(String(f.file || '').trim())) { echoes++; dropped++; continue; }
    const named = String(f.file || '').trim().replace(/^[./]+/, '');
    const key = named ? files.find((k) => k === named) || files.find((k) => k && (k.endsWith('/' + named) || named.endsWith('/' + k) || k.split('/').pop() === named.split('/').pop())) || null : null;
    const want = Number(f.line);
    let hits = key != null ? (evidence[key] || []).filter(matchLine(quote)) : [], at = key;
    if (!hits.length && !named && files.length === 1) { hits = (evidence[files[0]] || []).filter(matchLine(quote)); at = files[0]; }
    if (!hits.length && !named) for (const k of files) { const h = (evidence[k] || []).filter(matchLine(quote)); if (h.length) { hits = h; at = k; break; } }
    if (!hits.length) { dropped++; continue; }
    const best = Number.isFinite(want) ? hits.reduce((a, b) => (Math.abs(b[0] - want) < Math.abs(a[0] - want) ? b : a)) : hits[0];
    // a line its author marked right as written ("void-review: ok") is left out, as the quick checks leave it out (tools/review-pr.mjs)
    if (/void-review:\s*ok\b/.test(best[1])) { dropped++; continue; }
    if (uncountedGroupClaim(text, best[1])) { dropped++; continue; } // a group count the model cannot see (#590, REGEX_RULE)
    const id = at + ':' + best[0] + ':' + quote;
    if (seen.has(id)) { dropped++; continue; }
    seen.add(id);
    kept.push({ file: at, line: best[0], kind: normKind(f.kind), text: text.replace(/\s*[.;:]\s*$/, '') + '.', quote: best[1].trim() });
  }
  return { kept, dropped, echoes };
}
/** what the person reads: one line per validated finding in the quoted shape, then a summary built by code (never by the model) */
export function renderFindings(kept) {
  if (!kept.length) return 'Nothing to report on a closer read.';
  const lines = kept.map((f) => (f.file ? f.file + ':' : 'line ') + f.line + ' — ' + f.kind + ' — ' + f.text + ' — `' + f.quote.replace(/`/g, '\u02cb') + '`');
  const n = { bug: 0, risk: 0, style: 0 }; for (const f of kept) n[f.kind]++;
  const parts = [n.bug && n.bug + ' bug' + (n.bug > 1 ? 's' : ''), n.risk && n.risk + ' risk' + (n.risk > 1 ? 's' : ''), n.style && n.style + ' style'].filter(Boolean);
  return lines.join('\n\n') + '\n\n' + kept.length + ' finding' + (kept.length > 1 ? 's' : '') + ', each quoting its line: ' + parts.join(', ') + '.';
}
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

// The second pass (the skeptical check the leading reviewers run before they post): every finding the first pass kept goes back
// to the model, numbered, beside the code it was shown, with one question each: does this code prove the claim? A claim about
// code that is not shown (what another file's function returns, what a caller passes) does not hold. One call per review that
// has findings; when that call fails or answers nothing usable, every finding stays (the review is never emptier by accident).
export const VERIFY_SYSTEM = 'You check another reviewer\'s findings against the code. For each numbered finding, decide only from the code shown whether it is true. ' +
  'It holds when the shown code proves it. It does not hold when it depends on code that is not shown (what a function in another file returns, what a caller passes, how a value is shaped elsewhere), when the code already handles it, or when it misreads the code. ' +
  'Answer with JSON only, in exactly this shape: {"verdicts":[{"n":1,"holds":true,"why":"one short reason"}]}.';
export const VERDICTS_SCHEMA = { type: 'object', properties: { verdicts: { type: 'array', items: { type: 'object',
  properties: { n: { type: 'integer' }, holds: { type: 'boolean' }, why: { type: 'string' } }, required: ['n', 'holds'] } } }, required: ['verdicts'] };
export function verifyMessages(findings, shownCode) {
  const list = findings.map((f, i) => (i + 1) + '. ' + (f.file ? f.file + ':' : 'line ') + f.line + ' (' + f.kind + '): ' + f.text + ' Quoted line: ' + f.quote).join('\n');
  return [{ role: 'system', content: VERIFY_SYSTEM + ' ' + INJECTION_RULE + ' ' + MASK_RULE + ' ' + CSS_RULE + ' ' + REGEX_RULE },
    { role: 'user', content: 'Findings:\n' + list + '\n\nThe code they were made from:\n' + shownCode }];
}
/** the findings whose verdict says they hold; a finding with no verdict, or no usable verdicts at all, stays. Pure. */
export function applyVerdicts(findings, answer) {
  let j = answer;
  if (typeof j === 'string') { const m = j.match(/\{[\s\S]*\}/); try { j = m ? JSON.parse(m[0]) : null; } catch (_) { j = null; } }
  const verdicts = j && Array.isArray(j.verdicts) ? j.verdicts : null;
  if (!verdicts || !verdicts.length) return { kept: findings, refuted: [] };
  const no = new Map(verdicts.filter((v) => v && v.holds === false && Number.isInteger(Number(v.n))).map((v) => [Number(v.n), String(v.why || '').slice(0, 200)]));
  return { kept: findings.filter((f, i) => !no.has(i + 1)), refuted: findings.map((f, i) => (no.has(i + 1) ? { ...f, why: no.get(i + 1) } : null)).filter(Boolean) };
}
export async function verifyFindings(env, findings, shownCode) {
  if (!findings.length || !env || !env.AI) return { kept: findings, refuted: [] };
  try {
    const base = { messages: verifyMessages(findings, shownCode), max_tokens: 600, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' };
    let r;
    try { r = await env.AI.run(MODEL, { ...base, response_format: { type: 'json_schema', json_schema: VERDICTS_SCHEMA } }); }
    catch (_) { r = await env.AI.run(MODEL, base); }
    const out = r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response));
    return applyVerdicts(findings, out);
  } catch (_) { return { kept: findings, refuted: [] }; }
}

// The closer read by the model, told what the checks found. Keys are masked before the model sees anything. For a diff, the
// touched files' imports come along (DIFF_RULE). The model answers JSON (FINDINGS_SCHEMA; a model that refuses the schema is asked
// once more without it), the findings are validated against the code shown and rendered by code; dropPhantoms and quoteCheck run on
// the rendered lines as a second layer. closerReadDetail -> { answer, kept, dropped, parsed, echoes }; closerRead -> the answer alone.
export async function closerReadDetail(env, { ask, code, lang, diff, res, imports }) {
  const im = importsText(imports), shown = clipForModel(redact(String(code || '')));
  const messages = [
    { role: 'system', content: REVIEW_SYSTEM + ' ' + INJECTION_RULE + ' ' + MASK_RULE + ' ' + CSS_RULE + ' ' + REGEX_RULE + ' ' + JSON_RULE },
    { role: 'user', content: 'What they asked: ' + redact(String(ask || 'review this code')).slice(0, 300) + '\nLanguage (guessed): ' + lang + (diff ? '\n' + DIFF_RULE : '') + (shown.clipped ? '\n' + CLIP_RULE : '') + '\n\nQuick checks found:\n' + findingsText(res) + (im ? '\n\n' + redact(im) : '') + '\n\nThe code (keys masked):\n```\n' + shown.text + '\n```' },
  ];
  const base = { messages, max_tokens: 1400, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' };
  let r;
  try { r = await env.AI.run(MODEL, { ...base, response_format: { type: 'json_schema', json_schema: FINDINGS_SCHEMA } }); }
  catch (_) { r = await env.AI.run(MODEL, base); } // a model without JSON mode: the same ask, the shape held by the prompt alone
  const out = r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response));
  if (!out) return { answer: '', kept: 0, dropped: 0, parsed: false, echoes: 0 };
  const list = parseFindingsJson(typeof out === 'string' ? redact(out) : JSON.stringify(out));
  if (!list) return { answer: renderFindings([]), kept: 0, dropped: 0, parsed: false, echoes: 0 };
  const evidence = evidenceLines(shown.text, !!diff), v = validateFindings(list, evidence);
  // the second layer: a phantom claim (a name the file imports, the mask, a cut-off line) goes, and every rendered line must still quote
  const known = declaredNames(String(code || '') + '\n' + im);
  const sound = v.kept.filter((f) => dropPhantoms(f.text + ' `' + f.quote + '`', known, String(code || '') + '\n' + im, shown.clipped) !== '');
  const q = quoteCheck(renderFindings(sound).split('\n\n').slice(0, sound.length).join('\n'), evidence);
  const quoted = sound.slice(0, Math.min(q.kept, sound.length));
  // the second pass: each finding checked against the code it was made from; the refuted ones go
  const checked = await verifyFindings(env, quoted, shown.text);
  const kept = checked.kept.length, dropped = v.dropped + (v.kept.length - kept);
  return { answer: renderFindings(checked.kept), kept, dropped, parsed: true, echoes: v.echoes, refuted: checked.refuted.length };
}
export async function closerRead(env, opts) { return (await closerReadDetail(env, opts)).answer; }
