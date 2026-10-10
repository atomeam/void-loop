/**
 * challenge skill — learning.five-minute-challenge (domains/void.learning.md §3), frontier #17: "give me five minutes
 * with this" beside an explainer takes its `observations` unchanged (found through the `gives.observations` port, as the
 * quiz does) and runs predict, inspect, explain: predict a hidden value, reveal the source's answer, compare, for up to
 * three rounds in five minutes of active time. "turn the questions I missed into a five-minute challenge" takes the
 * quiz's missed items instead. Logic: skills/challenge-rules.js (tests: tools/learning.test.mjs). Never starts on its
 * own; not saved by default (an `ephemeral` stage kind) unless the visitor says "keep this challenge".
 */
import * as C from './challenge-rules.js';
import { sourceOf, payloadOf } from './quiz.js';

/** what the ask means: null, { start: true }, { start: true, missed: true } or { keep: true } */
export function challengeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:give\s+me|i\s+want|let\s+me\s+have)\s+(?:5|five)(?:\s+|-)minutes?\s+(?:with|on)\s+(?:this|that|it|the\s+(?:gears?|moon(?:\s+phases)?|explainer))(?:\s+please)?$|^(?:a\s+)?(?:5|five)(?:\s+|-)minute\s+challenge(?:\s+(?:with|on)\s+(?:this|that|it))?$/.test(t)) return { start: true };
  if (/^(?:turn|make)\s+(?:the\s+)?(?:questions?|ones?)\s+i\s+(?:missed|got\s+wrong)\s+into\s+a\s+(?:(?:5|five)(?:\s+|-)minute\s+)?challenge$|^challenge\s+me\s+on\s+(?:the\s+)?(?:ones?|questions?)\s+i\s+(?:missed|got\s+wrong)$/.test(t)) return { start: true, missed: true };
  if (/^(?:keep|save)\s+(?:this|the|my)\s+challenge$/.test(t)) return { keep: true };
  return null;
}

const NONE = 'Nothing here for a five-minute challenge yet · ask "explain gears" or "explain moon phases", then "give me five minutes with this"';
const clock = (ms) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function mount(th, stageApi) {
  if (!th.state || th.state.v !== 1) th.state = C.create();
  const now = () => Date.now();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card challenge-card';
  el.dataset.id = th.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Five-minute challenge: Enter starts, predicts and reveals; P pauses; F finishes');
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(400px, calc(100vw - 20px))';
  const head = document.createElement('div'); head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Five minutes</span><span class="g-sub challenge-src"></span>';
  const tray = document.createElement('div'); tray.className = 'challenge-tray'; tray.style.cssText = 'display:flex;align-items:center;gap:10px;margin:6px 0';
  const tokens = document.createElement('span'); tokens.className = 'challenge-tokens'; tokens.setAttribute('aria-label', 'rounds');
  // the countdown is Void's own timer face (void.html timerFace: the ring, m:ss, a state word), fed from this card's timestamps
  const timer = document.createElement('span'); timer.className = 'challenge-timer'; timer.style.cssText = 'margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-weight:700';
  const face = stageApi.timerFace ? stageApi.timerFace(timer) : (rem, total, word) => { timer.textContent = clock(rem) + ' ' + word; };
  tray.append(tokens, timer);
  const prompt = document.createElement('div'); prompt.className = 'challenge-prompt'; prompt.style.cssText = 'font-weight:600;margin:6px 0';
  const body = document.createElement('div'); body.className = 'challenge-body'; body.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center';
  const out = document.createElement('div'); out.className = 'challenge-result g-status'; out.setAttribute('aria-live', 'polite'); out.style.cssText = 'display:block;margin-top:8px;white-space:pre-line';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px';
  el.append(head, tray, prompt, body, out, bar);

  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (text, cls, fn) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = text; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const commit = (next) => { if (next === th.state) return; th.state = next; if (th.keep && stageApi.save) stageApi.save(); paint(); };
  el.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') { e.preventDefault(); commit(C.predict(th.state, e.target.value, now())); } return; }
    const next = C.onKey(th.state, e.key, now());
    if (next !== th.state) { e.preventDefault(); commit(next); }
  });
  // the display refreshes while it runs; the time itself always comes from the timestamps in the state
  let iv = null;
  const run = () => { if (!el.isConnected) { clearInterval(iv); iv = null; return; } const t = C.tick(th.state, now()); if (t !== th.state) commit(t); else paintTimer(); };

  function paintTimer() {
    const s = th.state;
    timer.style.visibility = s.showTimer ? '' : 'hidden'; // hiding the timer changes nothing about the timing
    face(C.remainingMs(s, now()), s.durationSeconds * 1000, s.status === 'active' ? 'running' : s.status === 'paused' ? 'paused' : C.isEnded(s) ? 'done' : 'ready');
  }
  function paint() {
    const s = th.state, i = C.currentIndex(s), r = s.rounds[i];
    el.querySelector('.challenge-src').textContent = s.snapshot ? 'on the ' + (th.sourceName || s.snapshot.source.cardId) + ' · snapshot' : '';
    tokens.textContent = s.rounds.map((x) => (x.revealed ? (x.correct ? '●' : '◐') : '○')).join(' ');
    body.textContent = ''; bar.textContent = ''; out.textContent = ''; prompt.textContent = '';
    paintTimer();
    if (s.status === 'active' && !iv) iv = setInterval(run, 250);
    if (s.status !== 'active' && iv) { clearInterval(iv); iv = null; }
    if (s.status === 'invalid') { prompt.textContent = 'That card\'s observations could not be read.'; out.textContent = s.errors.slice(0, 3).join('\n'); return; }
    if (s.status === 'empty') { prompt.textContent = s.snapshot ? 'Nothing on that card to predict yet.' : NONE; return; }
    if (s.status === 'ready') {
      prompt.textContent = s.rounds.length + ' round' + (s.rounds.length === 1 ? '' : 's') + ' · predict, then reveal and compare with the miniature · ' + Math.round(s.durationSeconds / 60) + ' minutes of active time';
      bar.append(btn('Start (Enter)', 'g-primary challenge-start', () => commit(C.start(th.state, now()))),
        btn(s.showTimer ? 'Hide timer' : 'Show timer', 'challenge-timer-toggle', () => commit(C.toggleTimer(th.state))));
      return;
    }
    if (C.isEnded(s)) {
      out.textContent = C.summary(s);
      bar.append(btn('Restart (Esc)', 'challenge-restart', () => commit(C.restart(th.state))));
      return;
    }
    prompt.textContent = 'Round ' + (i + 1) + ' of ' + s.rounds.length + ': ' + r.prompt;
    if (r.prediction === null) {
      if (r.type === 'choice') r.options.forEach((o, k) => { const b = btn((k + 1) + '. ' + o.label, 'challenge-option', () => commit(C.predict(th.state, o.id, now()))); b.dataset.option = o.id; if (s.draft === o.id) b.classList.add('g-primary'); body.append(b); });
      else {
        const inp = stop(document.createElement('input')); inp.type = 'text'; inp.inputMode = 'decimal'; inp.className = 'challenge-number'; inp.value = s.draft; inp.style.cssText = 'width:8em';
        inp.setAttribute('aria-label', 'your prediction in ' + r.unit);
        const unit = document.createElement('span'); unit.className = 'g-sub'; unit.textContent = r.unit;
        body.append(inp, unit, btn('Predict', 'g-primary challenge-predict', () => commit(C.predict(th.state, inp.value, now()))));
      }
      bar.append(btn('Reveal without predicting', 'challenge-reveal', () => commit(C.reveal(th.state, now()))));
    } else {
      out.textContent = 'You predicted ' + (r.type === 'choice' ? r.options.find((o) => o.id === r.prediction).label : String(+Number(r.prediction).toPrecision(6))) + '. Reveal the answer, then check it on the miniature.';
      bar.append(btn('Reveal (Enter)', 'g-primary challenge-reveal', () => commit(C.reveal(th.state, now()))));
    }
    bar.append(btn(s.status === 'paused' ? 'Resume (P)' : 'Pause (P)', 'challenge-pause', () => commit(th.state.status === 'paused' ? C.resume(th.state, now()) : C.pause(th.state, now()))),
      btn('Finish now (F)', 'challenge-finish', () => commit(C.finishNow(th.state, now()))));
    const last = s.rounds.filter((x) => x.revealed).pop();
    if (last) out.textContent = (out.textContent ? out.textContent + '\n' : '') + 'Last round: ' + last.label + ' was ' + last.answerLabel + (last.prediction === null ? '.' : last.correct ? ', as you predicted.' : ', not what you predicted.');
  }
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  const q = challengeOf(text);
  if (!q) return 'none';
  const things = api.stage.things(), kinds = api.stage.kinds ? api.stage.kinds() : {};
  const mine = Object.values(things).find((t) => t.kind === 'challenge');
  if (q.keep) {
    if (!mine) { api.say('No challenge on the stage to keep · say "give me five minutes with this" beside an explainer'); return 'challenge'; }
    mine.keep = true; api.stage.save && api.stage.save();
    api.say('Kept · this challenge stays on your stage (and your other devices); other learning cards still are not saved');
    return 'challenge';
  }
  const src = sourceOf(things, kinds, api.stage.selected && api.stage.selected(), q.missed ? { kind: 'quiz' } : {});
  if (!src) { api.say(q.missed ? 'No quiz on the stage · say "quiz me on this" beside an explainer first' : NONE); return 'challenge'; }
  const p = payloadOf(src, kinds);
  const state = C.take(C.create(), p.observations, p.explanation);
  const sourceName = src.kind === 'quiz' ? 'questions you missed' : src.kind === 'moon' ? 'Moon' : src.kind;
  if (mine) { mine.state = state; mine.sourceName = sourceName; if (mine.keep) api.stage.save && api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(mine.id); }
  else api.summon('challenge', { state, sourceName, center: true });
  api.say(state.status === 'ready' ? 'Five minutes on the ' + sourceName + ' · ' + state.rounds.length + ' round' + (state.rounds.length === 1 ? '' : 's') + ' · press Start when ready'
    : state.status === 'invalid' ? 'That card\'s observations could not be read'
    : q.missed ? 'Nothing missed to practise · every answer was right' : 'Nothing on the ' + sourceName + ' to predict yet');
  return 'challenge';
}

export default {
  name: 'challenge',
  challengeOf,
  examples: ['give me five minutes with this', 'give me 5 minutes with that', 'five minute challenge', 'turn the questions i missed into a five-minute challenge', 'challenge me on the ones i missed', 'keep this challenge'],
  nearMisses: ['give me five minutes', 'five minute timer', 'set a timer for five minutes', 'give me a challenge', 'five minutes from now', 'wait five minutes'],
  match(lower, text) { return !!challengeOf(text); },
  run,
  stageKinds: { challenge: { mount, ephemeral: true, learning: true, gives: { observations: (th) => C.gives(th.state, Date.now()).observations, explanation: (th) => C.gives(th.state, Date.now()).explanation } } },
};
