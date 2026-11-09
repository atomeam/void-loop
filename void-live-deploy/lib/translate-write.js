// Improve your own writing in the same language (DeepL Write, Reverso's rephraser, which the other translators also offer): a style
// (simple, business, academic, casual) or a tone (enthusiastic, friendly, confident, diplomatic), the same four and four DeepL Write gives,
// the text rewritten by Verse's free chat model, and the changes shown word by word. The pure half: the prompt, what comes back, the
// changes, and the saved phrases as a CSV a flashcard app imports. The route is POST /api/translate { mode: 'write' }.
// Tests: tools/translate-rivals.test.mjs (rules and route), tools/translate-rivals-e2e.mjs (the page in a browser).
import { nameOf } from './translate-langs.js';

export const STYLES = Object.freeze([
  { id: '', label: 'Any style' },
  { id: 'simple', label: 'Simple', how: 'plain, simple words and short sentences anyone can read' },
  { id: 'business', label: 'Business', how: 'a clear, polished business register' },
  { id: 'academic', label: 'Academic', how: 'a precise academic register' },
  { id: 'casual', label: 'Casual', how: 'a relaxed, casual register' },
]);
export const TONES = Object.freeze([
  { id: '', label: 'Any tone' },
  { id: 'enthusiastic', label: 'Enthusiastic', how: 'an enthusiastic tone' },
  { id: 'friendly', label: 'Friendly', how: 'a warm, friendly tone' },
  { id: 'confident', label: 'Confident', how: 'a confident, direct tone' },
  { id: 'diplomatic', label: 'Diplomatic', how: 'a tactful, diplomatic tone' },
]);
export const WRITE_MAX = 2000;

/** the chat messages that ask for the text improved in its own language. Pure. */
export function writePrompt(text, lang, style = '', tone = '') {
  const L = nameOf(lang) || 'the same language', s = STYLES.find((x) => x.id === style && x.id), t = TONES.find((x) => x.id === tone && x.id);
  const asks = ['Fix spelling, grammar and punctuation, and make it read naturally.'];
  if (s) asks.push('Write it in ' + s.how + '.'); if (t) asks.push('Use ' + t.how + '.');
  return [{ role: 'system', content: 'You are a careful ' + L + ' editor. Output only the improved ' + L + ' text, in ' + L + ': no quotes, no notes, no explanation, no translation.' },
    { role: 'user', content: 'Text:\n"""' + String(text) + '"""\n' + asks.join(' ') + ' Keep the meaning, names, numbers and paragraph breaks.' }];
}

/** the improved text, or '' when the answer is no use (empty, far longer or shorter, or wrapped in quotes the text did not have). Pure. */
export function rewrittenOf(answer, text) {
  let s = String(answer || '').trim().replace(/^```\w*\n?|```$/g, '').trim().replace(/^"""|"""$/g, '').trim();
  if (/^["“«].*["”»]$/s.test(s) && !/^["“«]/.test(String(text).trim())) s = s.slice(1, -1).trim();
  s = s.replace(/^(?:here is|here's)[^:\n]{0,60}:\s*/i, '');
  const n = String(text).length;
  if (!s || s.length > n * 2.5 + 80 || s.length < n / 3) return '';
  return s;
}

/** the changes from a to b, word by word (spaces kept with their word): [{ t, op }] with op '=', '+' or '-'. Pure (LCS; long texts by line). */
export function changes(a, b) {
  const tok = (s) => String(s || '').match(/\s+|[^\s]+/g) || [];
  const A = tok(a), B = tok(b);
  if (A.length * B.length > 4e6) return [...(a ? [{ t: a, op: '-' }] : []), ...(b ? [{ t: b, op: '+' }] : [])];
  const m = A.length, n = B.length, L = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [], add = (t, op) => { const p = out[out.length - 1]; if (p && p.op === op) p.t += t; else out.push({ t, op }); };
  let i = 0, j = 0;
  while (i < m && j < n) { if (A[i] === B[j]) { add(A[i], '='); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) add(A[i++], '-'); else add(B[j++], '+'); }
  while (i < m) add(A[i++], '-'); while (j < n) add(B[j++], '+');
  return out;
}
/** how many words changed. Pure. */
export const changedWords = (ch) => ch.filter((c) => c.op === '+').reduce((n, c) => n + (c.t.match(/[^\s]+/g) || []).length, 0);

/** saved phrases as CSV (front, back, the two languages): Anki, Quizlet and spreadsheets import it. Pure. */
export function phrasesCsv(saved) {
  const q = (s) => { const v = String(s == null ? '' : s); return /[",\n\r]|^[=+\-@]/.test(v) ? '"' + (/^[=+\-@]/.test(v) ? "'" : '') + v.replace(/"/g, '""') + '"' : v; };
  return ['Text,Translation,From,To', ...(saved || []).map((it) => [it.q, it.out, it.from || it.detected || '', it.to].map(q).join(','))].join('\r\n') + '\r\n';
}
