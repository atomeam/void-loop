/**
 * challenge rules — learning.five-minute-challenge (domains/void.learning.md §3): predict, inspect, explain on the
 * `observations` any explainer gives (or the quiz's missed items). Pure: no DOM, no timers. Time is derived from
 * timestamps (ms) the caller passes, never counted down per frame: elapsed = base + (now - startedAt) while active.
 *   create(params) / take(s, observations, explanation)   ready, never started on its own
 *   start / pause / resume / tick (s, now)                 tick ends it once when the time is up
 *   predict(s, value, now) / reveal(s, now)                the current round: a scored prediction, then the source's answer
 *   finishNow / restart / onKey(s, key, now) / gives(s, now)
 */
import { validateObservations, SCHEMA } from '../lib/observations.js';
import { eligible, grade, parseNumber } from './quiz-rules.js';

export const ROUNDS_MIN = 1, ROUNDS_MAX = 3, DEFAULT_SECONDS = 300;
const copy = (x) => JSON.parse(JSON.stringify(x));
const clampRounds = (n) => { const v = Number(n); return Number.isFinite(v) ? Math.max(ROUNDS_MIN, Math.min(ROUNDS_MAX, Math.round(v))) : ROUNDS_MAX; };
const ENDED = ['completed', 'time-ended', 'ended-early'];
export const isEnded = (s) => ENDED.includes(s.status);

export function create(p = {}) {
  const secs = Number(p.durationSeconds);
  return {
    v: 1, kind: 'learning.five-minute-challenge',
    durationSeconds: Number.isFinite(secs) && secs > 0 ? Math.round(secs) : DEFAULT_SECONDS,
    roundCount: clampRounds(p.roundCount ?? ROUNDS_MAX), showTimer: p.showTimer !== false,
    snapshot: null, explanation: null, errors: [], rounds: [], draft: '',
    base: 0, startedAt: null, status: 'empty', // empty | invalid | ready | active | paused | completed | time-ended | ended-early
  };
}

const round = (it) => {
  const a = it.assessment;
  return {
    id: it.id, label: it.label, type: it.valueType === 'number' ? 'number' : 'choice', prompt: a.prompt,
    unit: it.unit || null, tolerance: a.tolerance ?? null, options: a.options ? a.options.map((o) => ({ id: o.id, label: o.label })) : null,
    answer: it.valueType === 'number' ? it.value : a.answerId, answerLabel: a.answerLabel || it.displayValue || String(it.value),
    prediction: null, correct: null, revealed: false, reflection: '',
  };
};
const fresh = (s) => {
  const rounds = s.snapshot ? eligible(s.snapshot).slice(0, s.roundCount).map(round) : [];
  return { ...s, rounds, draft: '', base: 0, startedAt: null, status: !s.snapshot ? 'empty' : rounds.length ? 'ready' : 'empty' };
};

/** take a handoff: a copy, ready, never started (autoStart is off in version 1) */
export function take(s, payload, explanation = null) {
  const v = validateObservations(payload);
  if (!v.ok) return { ...s, snapshot: null, explanation: null, errors: v.errors, rounds: [], base: 0, startedAt: null, status: 'invalid' };
  return fresh({ ...s, snapshot: copy(payload), explanation: typeof explanation === 'string' ? explanation : null, errors: [] });
}
export const restart = (s) => fresh(s);
export function setRounds(s, n) { return s.status === 'ready' || s.status === 'empty' ? fresh({ ...s, roundCount: clampRounds(n) }) : s; }
export const toggleTimer = (s) => ({ ...s, showTimer: !s.showTimer }); // display only: the timing is untouched

export const elapsedMs = (s, now) => Math.min(s.durationSeconds * 1000, s.base + (s.status === 'active' && Number.isFinite(now) ? Math.max(0, now - s.startedAt) : 0));
export const remainingMs = (s, now) => Math.max(0, s.durationSeconds * 1000 - elapsedMs(s, now));

export const start = (s, now) => (s.status === 'ready' ? { ...s, status: 'active', startedAt: now, base: 0 } : s);
export const pause = (s, now) => { const t = tick(s, now); return t.status === 'active' ? { ...t, base: elapsedMs(t, now), startedAt: null, status: 'paused' } : t; };
export const resume = (s, now) => (s.status === 'paused' ? { ...s, status: 'active', startedAt: now } : s);

/** the time running out ends it once; an ended challenge never changes again on a tick */
export function tick(s, now) {
  if (s.status !== 'active' || remainingMs(s, now) > 0) return s;
  return { ...s, base: s.durationSeconds * 1000, startedAt: null, status: 'time-ended' };
}

export const currentIndex = (s) => s.rounds.findIndex((r) => !r.revealed);

/** a prediction is scored only while the challenge runs and before that round's answer was revealed */
export function predict(s, value, now) {
  const t = tick(s, now);
  if (t.status !== 'active') return t;
  const i = currentIndex(t), r = t.rounds[i];
  if (!r || r.revealed || r.prediction !== null) return t;
  const g = grade(r, value);
  if (!g) return t;
  const rounds = t.rounds.slice(); rounds[i] = { ...r, prediction: g.given, correct: g.correct };
  return { ...t, rounds, draft: '' };
}

/** show the source's answer for the current round (inspect the miniature); the last one completes it at once */
export function reveal(s, now) {
  const t = tick(s, now);
  if (t.status !== 'active') return t;
  const i = currentIndex(t);
  if (i < 0) return t;
  const rounds = t.rounds.slice(); rounds[i] = { ...rounds[i], revealed: true };
  const done = rounds.every((r) => r.revealed);
  return done ? { ...t, rounds, draft: '', base: elapsedMs(t, now), startedAt: null, status: 'completed' } : { ...t, rounds, draft: '' };
}

/** an optional, unscored sentence on a revealed round */
export function reflect(s, id, text) {
  const i = s.rounds.findIndex((r) => r.id === id && r.revealed);
  if (i < 0) return s;
  const rounds = s.rounds.slice(); rounds[i] = { ...rounds[i], reflection: String(text || '').slice(0, 280) };
  return { ...s, rounds };
}

export function finishNow(s, now) {
  const t = tick(s, now);
  return t.status === 'active' || t.status === 'paused' ? { ...t, base: elapsedMs(t, now), startedAt: null, status: 'ended-early' } : t;
}

/** keyboard: Enter starts, predicts (a choice by its number, a number typed), then reveals; P pauses, F finishes, Esc restarts after the end */
export function onKey(s, key, now) {
  const t = tick(s, now);
  if (t.status === 'ready') return key === 'Enter' || key === 's' || key === 'S' ? start(t, now) : t;
  if (t.status === 'paused') return key === 'p' || key === 'P' || key === 'Enter' ? resume(t, now) : key === 'f' || key === 'F' ? finishNow(t, now) : t;
  if (isEnded(t)) return key === 'Escape' ? restart(t) : t;
  if (t.status !== 'active') return t;
  if (key === 'p' || key === 'P') return pause(t, now);
  if (key === 'f' || key === 'F') return finishNow(t, now);
  const r = t.rounds[currentIndex(t)];
  if (r.prediction !== null) return key === 'Enter' ? reveal(t, now) : t;
  if (r.type === 'choice') {
    if (/^[1-9]$/.test(key) && +key <= r.options.length) return { ...t, draft: r.options[+key - 1].id };
    return key === 'Enter' ? predict(t, t.draft, now) : t;
  }
  if (/^[0-9.%-]$/.test(key)) return { ...t, draft: t.draft + key };
  if (key === 'Backspace') return { ...t, draft: t.draft.slice(0, -1) };
  return key === 'Enter' ? predict(t, t.draft, now) : t;
}

const label = (r, v) => (r.type === 'choice' ? (r.options.find((o) => o.id === v) || { label: v }).label : String(+Number(v).toPrecision(6)));
const firstSentence = (x) => { const m = /^[^.!?]*[.!?]/.exec(String(x || '').trim()); return m ? m[0] : null; };

/** the summary: results, the takeaway, what is unfinished; never a trait */
export function summary(s) {
  if (!isEnded(s)) return null;
  const predicted = s.rounds.filter((r) => r.prediction !== null), matched = predicted.filter((r) => r.correct), open = s.rounds.filter((r) => !r.revealed);
  const head = s.status === 'time-ended' ? 'Time is up.' : s.status === 'ended-early' ? 'Finished early.' : 'Done.';
  const lines = [head + ' ' + matched.length + ' of ' + s.rounds.length + ' predictions matched.'];
  for (const r of s.rounds) {
    if (!r.revealed && r.prediction === null) continue;
    lines.push((r.correct ? '✓ ' : r.prediction === null ? '· ' : '✗ ') + r.label + ': ' + (r.prediction === null ? 'no prediction' : 'you predicted ' + label(r, r.prediction)) + (r.revealed ? ', the answer was ' + r.answerLabel : ', answer not revealed'));
  }
  if (open.length) lines.push('Unfinished: ' + open.map((r) => r.label.toLowerCase()).join(', ') + '.');
  lines.push('Takeaway: ' + (firstSentence(s.explanation) || 'compare what you predicted with what the miniature shows, and look again at any that differed.'));
  return lines.join('\n');
}

/** the ports: predictions, revealed answers and outcomes; the takeaway; active time used (seconds) */
export function gives(s, now) {
  const src = s.snapshot ? s.snapshot.items : [];
  const items = s.rounds.map((r) => {
    const it = src.find((x) => x.id === r.id);
    return { ...copy(it), assessment: r.correct ? { enabled: false } : copy(it.assessment), prediction: r.prediction, revealed: r.revealed, result: r.prediction === null ? 'no-prediction' : r.correct ? 'matched' : 'differed' };
  });
  return {
    observations: { schema: SCHEMA, source: { cardId: 'challenge', revision: 1 }, items },
    explanation: summary(s),
    elapsed: Math.round(elapsedMs(s, now) / 1000),
    model: { kind: 'learning.five-minute-challenge', version: 1, parameters: { durationSeconds: s.durationSeconds, roundCount: s.roundCount, mode: 'predict-inspect-explain', showTimer: s.showTimer, autoStart: false }, state: { rounds: copy(s.rounds), activeElapsedMilliseconds: elapsedMs(s, now), status: s.status } },
  };
}

export { parseNumber };
