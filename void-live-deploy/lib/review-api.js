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
export function dropPhantoms(answer, known, code = '') {
  const paras = String(answer || '').split(/\n[ \t]*\n/), kept = [];
  for (const p of paras) if (!phantomNames(p, known, code).length) kept.push(p);
  const out = [];
  for (let i = 0; i < kept.length; i++) {
    const isHead = /^\s*(?:#{1,6}\s|\*\*[^*\n]{2,60}\*\*\s*:?\s*$)/.test(kept[i]) && kept[i].trim().split('\n').length === 1;
    const nextHead = i + 1 >= kept.length || /^\s*(?:#{1,6}\s|\*\*[^*\n]{2,60}\*\*\s*:?\s*$|\*\*Not blocking|<sub>)/.test(kept[i + 1]);
    if (isHead && nextHead && kept.length !== paras.length) continue; // only when something was dropped
    out.push(kept[i]);
  }
  return out.join('\n\n').trim();
}

// The closer read by the model, told what the checks found. Keys are masked before the model sees anything. For a diff, the
// touched files' imports come along (DIFF_RULE) and phantom findings are taken out of the answer (dropPhantoms).
export async function closerRead(env, { ask, code, lang, diff, res, imports }) {
  const im = importsText(imports);
  const r = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: REVIEW_SYSTEM + ' ' + INJECTION_RULE + ' ' + MASK_RULE },
      { role: 'user', content: 'What they asked: ' + redact(String(ask || 'review this code')).slice(0, 300) + '\nLanguage (guessed): ' + lang + (diff ? '\n' + DIFF_RULE : '') + '\n\nQuick checks found:\n' + findingsText(res) + (im ? '\n\n' + redact(im) : '') + '\n\nThe code (keys masked):\n```\n' + redact(String(code || '')).slice(0, MODEL_CODE_MAX) + '\n```' },
    ],
    max_tokens: 1400, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low',
  });
  const out = r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response));
  const known = declaredNames(String(code || '') + '\n' + im);
  return dropPhantoms(redact(String(out || '').trim()), known, String(code || '') + '\n' + im);
}
