/**
 * trivia skill — "trivia", "play trivia", "a trivia game"; and "quiz me" on an empty stage (skills/quiz.js hands it here).
 * Five questions, four choices, right or wrong at once, a score at the end and another round. The bank and the rules: lib/trivia.js (pure).
 */
import * as T from '../lib/trivia.js';
import { takeFocus } from '../lib/card-focus.js';

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card trivia-card'; el.dataset.id = th.id; el.tabIndex = 0; el.setAttribute('aria-label', 'Trivia');
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(420px, calc(100vw - 20px))';
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el); takeFocus(el);
  if (!th.state || !Array.isArray(th.state.qs)) th.state = T.create();
  const b = (label, fn, cls = '') => { const x = document.createElement('button'); x.type = 'button'; x.className = 'g-btn ' + cls; x.textContent = label; x.style.cssText = 'text-align:left;padding:10px 12px'; x.addEventListener('pointerdown', (e) => e.stopPropagation()); x.addEventListener('click', (e) => { e.stopPropagation(); fn(x); }); return x; };
  const paint = () => {
    const s = th.state, n = s.qs.length;
    el.innerHTML = '<div class="g-head"><span class="g-title">Trivia</span><span class="g-sub"></span></div>';
    el.querySelector('.g-sub').textContent = s.at < n ? 'Question ' + (s.at + 1) + ' of ' + n + ' · ' + s.score + ' right' : s.score + ' of ' + n + ' right';
    const body = document.createElement('div'); body.style.cssText = 'display:grid;gap:8px;margin-top:8px';
    if (s.at < n) {
      const q = s.qs[s.at], h = document.createElement('div'); h.textContent = q.q; h.style.cssText = 'font-size:17px;font-weight:600;line-height:1.35';
      body.append(h);
      for (const c of q.choices) body.append(b(c, () => {
        const right = c === q.a;
        for (const x of body.querySelectorAll('button')) { x.disabled = true; if (x.textContent === q.a) x.style.outline = '2px solid #5fd38d'; }
        if (!right) (body.querySelectorAll('button')[q.choices.indexOf(c)]).style.outline = '2px solid #ff6b6b';
        const fb = document.createElement('div'); fb.textContent = right ? 'Right!' : 'Not quite: ' + q.a + '.'; fb.style.cssText = 'font-size:14px'; body.append(fb);
        setTimeout(() => { th.state = T.pick(th.state, c); paint(); }, right ? 700 : 1300);
      }));
    } else {
      const big = document.createElement('div'); big.textContent = s.score + ' / ' + n + ' · ' + T.verdict(s.score, n); big.style.cssText = 'font-size:22px;font-weight:700';
      const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
      row.append(b('Another round', () => { th.state = T.create(); paint(); }, 'g-primary'));
      row.append(b('Play chess', () => { try { stageApi.ask('play chess'); } catch (_) {} }));
      body.append(big, row);
    }
    el.append(body);
  };
  paint();
}

/** puts a fresh round up (or a new one on the trivia card already there). */
export function startRound(api) {
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'trivia');
  if (existing) { existing.state = T.create(); api.stage.render(); if (api.stage.center) api.stage.center(existing.id); }
  else api.summon('trivia', { x: Math.max(10, Math.round(innerWidth / 2 - 210)), y: 60, state: T.create() });
  api.say('Trivia · five questions, tap an answer');
  return 'trivia';
}

export default {
  name: 'trivia',
  examples: ['trivia', 'play trivia', 'trivia game', 'ask me trivia questions'],
  nearMisses: ['quiz me on this', 'trivia about france', 'pub quiz near me'],
  match(lower, text) { return T.triviaOf(text || lower); },
  run(text, api) { return T.triviaOf(text) ? startRound(api) : 'none'; },
  stageKinds: { trivia: { mount, ephemeral: true } },
};
