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
export const MODEL = '@cf/google/gemma-4-26b-a4b-it';

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

// The closer read by the model, told what the checks found. Keys are masked before the model sees anything.
export async function closerRead(env, { ask, code, lang, diff, res }) {
  const r = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: REVIEW_SYSTEM + ' ' + INJECTION_RULE },
      { role: 'user', content: 'What they asked: ' + redact(String(ask || 'review this code')).slice(0, 300) + '\nLanguage (guessed): ' + lang + (diff ? '\nThis is a pull request diff: review the added lines (+), using the rest as context.' : '') + '\n\nQuick checks found:\n' + findingsText(res) + '\n\nThe code (keys masked):\n```\n' + redact(code).slice(0, MODEL_CODE_MAX) + '\n```' },
    ],
    max_tokens: 1400, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low',
  });
  const out = r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response));
  return redact(String(out || '').trim());
}
