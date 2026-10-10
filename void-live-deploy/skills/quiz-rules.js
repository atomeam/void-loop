/**
 * quiz rules — learning.quiz (domains/void.learning.md §2): the card that takes `observations` from any explainer
 * unchanged and turns its assessable items into a short question deck. Pure: no DOM, so tools/learning.test.mjs runs it
 * in node. One authoritative state; every action returns a new state, so a doubled click can't score twice.
 *   create(params)                    a fresh deck, no snapshot yet (status 'empty')
 *   take(s, observations, explanation) snapshot a source's payload (copied: the source moving never changes it)
 *   answer(s, value) / next(s)        score one answer (number, or an option id), then move on
 *   retryMissed(s) / refresh(s, p) / reset(s)
 *   onKey(s, key)                     the whole quiz from the keyboard: digits, '.', Backspace, Enter
 *   gives(s)                          { observations, explanation, score, model }: the ports this card gives
 */
import { validateObservations, SCHEMA } from '../lib/observations.js';

export const COUNT_MIN = 1, COUNT_MAX = 5;
export const MODES = ['mixed', 'numeric', 'choice'];
export const FEEDBACK = ['after-answer', 'at-end'];
export const NEXT_ASK = 'give me five minutes with this';

const copy = (x) => JSON.parse(JSON.stringify(x));
const clampCount = (n) => { const v = Number(n); return Number.isFinite(v) ? Math.max(COUNT_MIN, Math.min(COUNT_MAX, Math.round(v))) : 3; };

export function create(p = {}) {
  return {
    v: 1, kind: 'learning.quiz',
    questionCount: clampCount(p.questionCount ?? 3),
    answerMode: MODES.includes(p.answerMode) ? p.answerMode : 'mixed',
    feedback: FEEDBACK.includes(p.feedback) ? p.feedback : 'after-answer',
    snapshot: null, explanation: null, errors: [],
    questions: [], current: 0, responses: [], draft: '', attempt: 0,
    status: 'empty', // empty | invalid | answering | feedback | complete
  };
}

/** the items a quiz may ask: assessment on, a number with a tolerance or a text item with the source's own options */
export function eligible(payload, mode = 'mixed') {
  return (payload.items || []).filter((it) => it.assessment && it.assessment.enabled
    && (it.valueType === 'number' ? mode !== 'choice' : mode !== 'numeric' && Array.isArray(it.assessment.options)));
}

const question = (it) => {
  const a = it.assessment;
  return it.valueType === 'number'
    ? { id: it.id, type: 'number', prompt: a.prompt, unit: it.unit, answer: it.value, tolerance: a.tolerance, answerLabel: a.answerLabel || it.displayValue || String(it.value), label: it.label }
    : { id: it.id, type: 'choice', prompt: a.prompt, options: a.options.map((o) => ({ id: o.id, label: o.label })), answer: a.answerId, answerLabel: a.answerLabel || it.displayValue, label: it.label };
};

function deck(s, items) {
  const qs = items.slice(0, s.questionCount).map(question);
  return { ...s, questions: qs, current: 0, responses: [], draft: '', attempt: s.attempt + 1, status: qs.length ? 'answering' : 'empty' };
}

/** take a source's payload: a malformed one is refused with its reasons, never half-read */
export function take(s, payload, explanation = null) {
  const v = validateObservations(payload);
  if (!v.ok) return { ...s, snapshot: null, explanation: null, errors: v.errors, questions: [], responses: [], current: 0, draft: '', status: 'invalid' };
  const snap = copy(payload);
  return deck({ ...s, snapshot: snap, explanation: typeof explanation === 'string' ? explanation : null, errors: [] }, eligible(snap, s.answerMode));
}
export const refresh = (s, payload, explanation) => take({ ...s, attempt: s.attempt }, payload, explanation);
export const reset = (s) => (s.snapshot ? deck(s, eligible(s.snapshot, s.answerMode)) : create(s));
export function setCount(s, n) { const c = clampCount(n); return s.snapshot ? deck({ ...s, questionCount: c }, eligible(s.snapshot, s.answerMode)) : { ...s, questionCount: c }; }

/** a typed number in the question's unit; '50%' reads as 0.5 for a fraction */
export function parseNumber(raw, unit) {
  const t = String(raw ?? '').trim().replace(/,/g, '');
  const m = /^([-+]?(?:\d+\.?\d*|\.\d+))\s*(%)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? (unit === 'fraction' ? n / 100 : null) : n;
}

export function grade(q, value) {
  if (q.type === 'number') {
    const n = typeof value === 'number' ? value : parseNumber(value, q.unit);
    if (n === null || !Number.isFinite(n)) return null; // not an answer: nothing is scored
    return { given: n, correct: Math.abs(n - q.answer) <= q.tolerance + 1e-9 };
  }
  if (!q.options.some((o) => o.id === value)) return null;
  return { given: value, correct: value === q.answer };
}

/** one scored answer per question: a second submit, or one after the deck is done, changes nothing */
export function answer(s, value) {
  if (s.status !== 'answering') return s;
  const q = s.questions[s.current];
  if (!q || s.responses.some((r) => r.id === q.id)) return s;
  const g = grade(q, value);
  if (!g) return s;
  const responses = s.responses.concat({ id: q.id, given: g.given, correct: g.correct });
  const done = s.current + 1 >= s.questions.length;
  if (s.feedback === 'after-answer') return { ...s, responses, draft: '', status: 'feedback' };
  return { ...s, responses, draft: '', current: done ? s.current : s.current + 1, status: done ? 'complete' : 'answering' };
}
export function next(s) {
  if (s.status !== 'feedback') return s;
  return s.current + 1 >= s.questions.length ? { ...s, status: 'complete' } : { ...s, current: s.current + 1, status: 'answering' };
}

export const missed = (s) => s.questions.filter((q) => { const r = s.responses.find((x) => x.id === q.id); return !r || !r.correct; });
export const score = (s) => (s.questions.length ? s.responses.filter((r) => r.correct).length / s.questions.length : 0);

/** a new attempt with only the questions missed last time */
export function retryMissed(s) {
  if (s.status !== 'complete') return s;
  const ids = new Set(missed(s).map((q) => q.id));
  if (!ids.size) return s;
  return { ...s, questions: s.questions.filter((q) => ids.has(q.id)), current: 0, responses: [], draft: '', attempt: s.attempt + 1, status: 'answering' };
}

/** the keyboard drives everything: a choice by its number, a number typed, Enter to submit or go on, R retry, Escape reset */
export function onKey(s, key) {
  if (s.status === 'feedback') return key === 'Enter' || key === ' ' ? next(s) : s;
  if (s.status === 'complete') return key === 'r' || key === 'R' ? retryMissed(s) : key === 'Escape' ? reset(s) : s;
  if (s.status !== 'answering') return s;
  if (key === 'Escape') return reset(s);
  const q = s.questions[s.current];
  if (q.type === 'choice') {
    if (/^[1-9]$/.test(key) && +key <= q.options.length) return { ...s, draft: q.options[+key - 1].id };
    if (key === 'Enter') return answer(s, s.draft);
    return s;
  }
  if (/^[0-9.%-]$/.test(key)) return { ...s, draft: s.draft + key };
  if (key === 'Backspace') return { ...s, draft: s.draft.slice(0, -1) };
  if (key === 'Enter') return answer(s, s.draft);
  return s;
}

/** the review: right answers and the missed items, no personality or ability label */
export function review(s) {
  if (s.status !== 'complete') return null;
  const right = s.responses.filter((r) => r.correct).length, miss = missed(s);
  const lines = [right + ' of ' + s.questions.length + ' right.'];
  for (const q of s.questions) {
    const r = s.responses.find((x) => x.id === q.id), ok = r && r.correct;
    lines.push((ok ? '✓ ' : '✗ ') + q.label + ': ' + q.answerLabel + (ok ? '' : r ? ' (you said ' + givenLabel(q, r.given) + ')' : ''));
  }
  if (miss.length) lines.push('Look again at: ' + miss.map((q) => q.label.toLowerCase()).join(', ') + '.');
  lines.push('Next: ask "' + NEXT_ASK + '" for a five-minute challenge on it.');
  return lines.join('\n');
}
const givenLabel = (q, g) => (q.type === 'choice' ? (q.options.find((o) => o.id === g) || { label: g }).label : String(g));

/** the ports: per-question results (assessment stays on for missed items, off for correct ones), the review, the score */
export function gives(s) {
  const src = s.snapshot ? s.snapshot.items : [];
  const items = s.questions.map((q) => {
    const it = src.find((x) => x.id === q.id), r = s.responses.find((x) => x.id === q.id), ok = !!(r && r.correct);
    return { ...copy(it), assessment: ok ? { enabled: false } : copy(it.assessment), result: r ? (ok ? 'correct' : 'missed') : 'unanswered' };
  });
  return {
    observations: { schema: SCHEMA, source: { cardId: 'quiz', revision: s.attempt }, items },
    explanation: review(s),
    score: score(s),
    model: { kind: 'learning.quiz', version: 1, parameters: { questionCount: s.questionCount, answerMode: s.answerMode, feedback: s.feedback }, state: { currentQuestion: s.current, responses: copy(s.responses), status: s.status } },
  };
}

/** what the stage saves: a quiz (any ephemeral kind) only when the visitor asked to keep that one card */
export function persistable(things, kinds) {
  const out = {};
  for (const [id, t] of Object.entries(things || {})) if (!(t && kinds[t.kind] && kinds[t.kind].ephemeral) || t.keep) out[id] = t;
  return out;
}
