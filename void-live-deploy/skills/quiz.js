/**
 * quiz skill — learning.quiz (domains/void.learning.md §2), frontier #17: "quiz me on this" beside an explainer takes
 * that card's `observations` unchanged (whatever card sent it: the gears, the Moon, any later explainer that declares
 * `gives.observations` on its stage kind) and asks one question at a time from the source's own prompts and options.
 * All the logic is skills/quiz-rules.js (tests: tools/learning.test.mjs). Not saved by default: the stage skips an
 * `ephemeral` kind unless the visitor says "keep this quiz".
 * "quiz me on this", "quiz me", "test me on that", "keep this quiz".
 */
import * as Q from './quiz-rules.js';

/** what the ask means: null, { start: true } or { keep: true } */
export function quizOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:quiz|test)\s+me(?:\s+(?:on|about)\s+(?:this|that|it|these|those|the\s+(?:gears?|moon(?:\s+phases)?|explainer)))?(?:\s+please)?$|^(?:give\s+me\s+)?a\s+quiz\s+on\s+(?:this|that|it)$/.test(t)) return { start: true };
  if (/^(?:keep|save)\s+(?:this|the|my)\s+quiz$/.test(t)) return { keep: true };
  return null;
}

/** the explainer to quiz on: the selected one, else the newest on the stage whose kind gives observations */
export function sourceOf(things, kinds, selectedId, opts = {}) {
  // explainers by default; a learning card (the quiz, the challenge) only when asked for by kind (its missed items)
  const want = (t) => (opts.kind ? t.kind === opts.kind : !kinds[t.kind].learning);
  const gives = (t) => t && kinds[t.kind] && kinds[t.kind].gives && typeof kinds[t.kind].gives.observations === 'function' && want(t);
  if (selectedId && gives(things[selectedId])) return things[selectedId];
  const list = Object.values(things || {}).filter(gives);
  return list.length ? list[list.length - 1] : null;
}

export function payloadOf(th, kinds) {
  const g = kinds[th.kind].gives;
  return { observations: g.observations(th), explanation: g.explanation ? g.explanation(th) : null };
}

const NONE = 'Nothing here to quiz on yet · ask "explain gears" or "explain moon phases", play with it, then "quiz me on this"';

function mount(th, stageApi) {
  if (!th.state || th.state.v !== 1) th.state = Q.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card quiz-card';
  el.dataset.id = th.id;
  el.tabIndex = 0;
  el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Quiz: number keys pick an answer, Enter submits and goes on');
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(400px, calc(100vw - 20px))';
  const head = document.createElement('div'); head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Quiz</span><span class="g-sub quiz-src"></span>';
  const progress = document.createElement('div'); progress.className = 'quiz-progress g-sub'; progress.style.cssText = 'margin:6px 0';
  const prompt = document.createElement('div'); prompt.className = 'quiz-prompt'; prompt.style.cssText = 'font-weight:600;margin:6px 0';
  const body = document.createElement('div'); body.className = 'quiz-body'; body.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center';
  const feedback = document.createElement('div'); feedback.className = 'quiz-feedback g-status'; feedback.setAttribute('aria-live', 'polite'); feedback.style.cssText = 'display:block;margin-top:8px;white-space:pre-line';
  const ctx = document.createElement('div'); ctx.className = 'g-rules quiz-context';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px';
  el.append(head, progress, prompt, body, feedback, bar, ctx);

  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  // ephemeral by default: a change is saved only when this card was kept (the stage drops it from the save otherwise)
  const commit = (next) => { if (next === th.state) return; th.state = next; if (th.keep && stageApi.save) stageApi.save(); paint(); };
  el.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.key === 'Enter') { e.preventDefault(); commit(Q.answer(th.state, e.target.value)); } return; }
    const next = Q.onKey(th.state, e.key);
    if (next !== th.state) { e.preventDefault(); commit(next); }
  });

  function paint() {
    const s = th.state, q = s.questions[s.current];
    el.querySelector('.quiz-src').textContent = s.snapshot ? 'on the ' + (th.sourceName || s.snapshot.source.cardId) + ' · snapshot' : '';
    progress.textContent = s.questions.length ? 'Question ' + Math.min(s.current + 1, s.questions.length) + ' of ' + s.questions.length + (s.attempt > 1 ? ' · attempt ' + s.attempt : '') : '';
    body.textContent = ''; bar.textContent = ''; feedback.textContent = ''; prompt.textContent = '';
    ctx.textContent = s.explanation ? 'From the source card: ' + s.explanation : '';
    if (s.status === 'invalid') { prompt.textContent = 'That card\'s observations could not be read.'; feedback.textContent = s.errors.slice(0, 3).join('\n'); return; }
    if (s.status === 'empty') { prompt.textContent = s.snapshot ? 'Nothing on that card can be asked as a question yet.' : NONE; return; }
    if (s.status === 'complete') {
      feedback.textContent = Q.review(s);
      if (Q.missed(s).length) bar.append(btn('Retry missed (R)', 'g-primary quiz-retry', () => commit(Q.retryMissed(th.state))));
      bar.append(btn('Start over (Esc)', 'quiz-reset', () => commit(Q.reset(th.state))));
      return;
    }
    prompt.textContent = q.prompt;
    const done = s.responses.find((r) => r.id === q.id);
    if (q.type === 'choice') {
      q.options.forEach((o, i) => {
        const b = btn((i + 1) + '. ' + o.label, 'quiz-option', () => commit(Q.answer(th.state, o.id)));
        b.dataset.option = o.id; b.disabled = !!done;
        if (s.draft === o.id) b.classList.add('g-primary');
        body.append(b);
      });
    } else {
      const inp = stop(document.createElement('input')); inp.type = 'text'; inp.inputMode = 'decimal'; inp.className = 'quiz-number';
      inp.setAttribute('aria-label', 'your answer in ' + q.unit); inp.value = s.draft; inp.disabled = !!done; inp.style.cssText = 'width:8em';
      const unit = document.createElement('span'); unit.className = 'g-sub'; unit.textContent = q.unit;
      body.append(inp, unit, btn('Check', 'g-primary quiz-check', () => commit(Q.answer(th.state, inp.value))));
      if (!done) setTimeout(() => { if (document.activeElement === el || document.activeElement === document.body) inp.focus(); }, 0);
    }
    if (s.status === 'feedback') {
      feedback.textContent = (done.correct ? 'Right. ' : 'Not quite. ') + 'The answer: ' + q.answerLabel + '.';
      bar.append(btn(s.current + 1 >= s.questions.length ? 'See the review (Enter)' : 'Next (Enter)', 'g-primary quiz-next', () => commit(Q.next(th.state))));
    }
  }
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  const q = quizOf(text);
  if (!q) return 'none';
  const things = api.stage.things(), kinds = api.stage.kinds ? api.stage.kinds() : {};
  const quiz = Object.values(things).find((t) => t.kind === 'quiz');
  if (q.keep) {
    if (!quiz) { api.say('No quiz on the stage to keep · say "quiz me on this" beside an explainer'); return 'quiz'; }
    quiz.keep = true; api.stage.save && api.stage.save();
    api.say('Kept · this quiz stays on your stage (and your other devices); other quizzes still are not saved');
    return 'quiz';
  }
  const src = sourceOf(things, kinds, api.stage.selected && api.stage.selected());
  if (!src) { api.say(NONE); return 'quiz'; }
  const p = payloadOf(src, kinds);
  const state = Q.take(Q.create(), p.observations, p.explanation), sourceName = src.kind === 'moon' ? 'Moon' : src.kind;
  if (quiz) { quiz.state = state; quiz.sourceName = sourceName; if (quiz.keep) api.stage.save && api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(quiz.id); }
  else api.summon('quiz', { state, sourceName, center: true });
  api.say(state.status === 'answering' ? 'Quiz on the ' + sourceName + ' · ' + state.questions.length + ' question' + (state.questions.length === 1 ? '' : 's') + ' · number keys and Enter work too'
    : state.status === 'invalid' ? 'That card\'s observations could not be read' : 'Nothing on the ' + sourceName + ' can be asked as a question yet');
  return 'quiz';
}

export default {
  name: 'quiz',
  quizOf,
  examples: ['quiz me on this', 'quiz me', 'test me on that', 'test me on this', 'quiz me on the gears', 'keep this quiz'],
  nearMisses: ['quiz', 'pub quiz near me', 'test my internet speed', 'quiz show', 'make a quiz about france', 'i need to pass my quiz by friday'],
  match(lower, text) { return !!quizOf(text); },
  run,
  // ephemeral: never saved or synced unless kept; it gives its per-question results, missed items still assessable
  stageKinds: { quiz: { mount, ephemeral: true, learning: true, takes: { observations: 'snapshot' }, gives: { observations: (th) => Q.gives(th.state).observations, explanation: (th) => Q.gives(th.state).explanation } } },
};
