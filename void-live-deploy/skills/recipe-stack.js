/**
 * recipe-stack skill — "cook pasta: boil 10 min then rest 2": one card with sequential timed steps that advance by
 * themselves. A step with no unit counts minutes. A soft two-note chime plays at each hand-over, but only once the person
 * has tapped Start on this page (browsers allow sound only after a gesture; no gesture, no sound). Timing works like the
 * timer's: a start time plus time already used, so a reload or redraw keeps the clock. Device-local; nothing is sent.
 * Asked for by the owner (2026-10-18).
 */
import { escHtml, addThing, cardEl, keepOut, tidy } from '../lib/stage-pack.js';

const MAX_STEPS = 12;
const UNIT_MS = { h: 3600000, m: 60000, s: 1000 };

/** "10 min" / "2" / "1 hour" / "30 sec" inside a step: { label, ms } or null when it has no length. Pure. */
export function parseStep(raw) {
  const s = String(raw || '').trim().replace(/^(?:and\s+)?(?:then\s+)?/i, '');
  const m = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)?\b/i.exec(s);
  if (!m) return null;
  const unit = (m[2] || 'm').charAt(0).toLowerCase();
  const ms = Math.round(parseFloat(m[1]) * UNIT_MS[unit]);
  const label = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\b(?:for|about|around|of)\b/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Step';
  return ms > 0 && ms <= 24 * 3600000 ? { label: label.charAt(0).toUpperCase() + label.slice(1), ms } : null;
}

/** the title and steps an ask names, or null when it is not a recipe-stack ask. Pure. */
export function parseRecipe(text) {
  const m = /^(?:please\s+)?(?:cook|make|prepare|prep|bake)\s+([^:]{1,40}?)\s*:\s*(.+)$/i.exec(tidy(text));
  if (!m) return null;
  const steps = m[2].split(/\s*(?:,|;|->|→|\bthen\b|\band then\b)\s*/i).map(parseStep).filter(Boolean).slice(0, MAX_STEPS);
  return steps.length ? { title: m[1].trim().replace(/^(?:a|an|some|the)\s+/i, '').replace(/^./, (c) => c.toUpperCase()), steps } : null;
}

/** where a recipe is after `elapsed` ms: { idx, remaining (of the current step), done }. Pure. */
export function stepAt(steps, elapsed) {
  let left = Math.max(0, elapsed);
  for (let i = 0; i < steps.length; i++) {
    if (left < steps[i].ms) return { idx: i, remaining: steps[i].ms - left, done: false };
    left -= steps[i].ms;
  }
  return { idx: steps.length, remaining: 0, done: true };
}

/** time used so far for a card: what was banked plus the run in progress. Pure. */
export const elapsedOf = (th, now = Date.now()) => (th.elapsed || 0) + (th.running && th.startedAt ? Math.max(0, now - th.startedAt) : 0);

export const clock = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// sound: one AudioContext, made inside a tap (Start / Resume), never before
let ac = null;
/** make or wake the audio context; call only from a user gesture. AC may be passed for a test. */
export function unlockAudio(AC) {
  try {
    const C = AC || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
    if (!C) return null;
    if (!ac) ac = new C();
    if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {});
  } catch (_) { ac = null; }
  return ac;
}
/** a soft two-note chime on the unlocked context; false when there is none (no tap yet, or no Web Audio). */
export function chime(ctx = ac) {
  if (!ctx || ctx.state === 'closed') return false;
  try {
    const t0 = ctx.currentTime;
    [[660, 0], [880, 0.18]].forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.12, t0 + d + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.7);
      o.connect(g); g.connect(ctx.destination); o.start(t0 + d); o.stop(t0 + d + 0.75);
    });
    return true;
  } catch (_) { return false; }
}

const lastIdx = new Map(); // card id -> step index last drawn, so a redraw never chimes twice

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'recipe-stack');
  const steps = th.steps || [];
  const head = document.createElement('div'); head.innerHTML = '<b>' + escHtml(th.title || 'Recipe') + '</b>'; head.style.marginBottom = '6px';
  const list = document.createElement('ol'); list.style.cssText = 'margin:0 0 6px;padding-left:1.4em';
  const items = steps.map((s) => { const li = document.createElement('li'); li.textContent = s.label + ' · ' + clock(s.ms); list.appendChild(li); return li; });
  const big = document.createElement('div'); big.className = 'rs-time'; big.style.cssText = 'font:600 30px/1.1 ui-monospace,Menlo,Consolas,monospace;margin:4px 0';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px';
  const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'font:inherit;padding:2px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); keepOut(b); bar.appendChild(b); return b; };
  const total = steps.reduce((s, x) => s + x.ms, 0);
  const go = btn(th.running ? 'Pause' : (elapsedOf(th) > 0 && elapsedOf(th) < total ? 'Resume' : 'Start'), () => {
    unlockAudio(); // the gesture that allows sound
    if (th.running) { th.elapsed = elapsedOf(th); th.running = false; th.startedAt = 0; }
    else { if (elapsedOf(th) >= total) th.elapsed = 0; th.running = true; th.startedAt = Date.now(); lastIdx.set(th.id, stepAt(steps, elapsedOf(th)).idx); }
    stageApi.save(); stageApi.render();
  });
  go.className = 'rs-go';
  btn('Reset', () => { th.elapsed = 0; th.running = false; th.startedAt = 0; lastIdx.delete(th.id); stageApi.save(); stageApi.render(); });
  el.append(head, list, big, bar);

  const paint = () => {
    const st = stepAt(steps, elapsedOf(th));
    items.forEach((li, i) => { li.style.opacity = i < st.idx ? '.4' : '1'; li.style.fontWeight = i === st.idx ? '700' : '400'; li.style.textDecoration = i < st.idx ? 'line-through' : 'none'; });
    big.textContent = st.done ? 'Done' : clock(st.remaining);
    el.dataset.step = String(st.idx);
    return st;
  };
  let st = paint();
  if (!lastIdx.has(th.id)) lastIdx.set(th.id, st.idx);
  if (th.running) {
    const iv = setInterval(() => {
      if (!el.isConnected) return clearInterval(iv);
      st = paint();
      if (st.idx !== lastIdx.get(th.id)) {
        lastIdx.set(th.id, st.idx);
        chime();
        stageApi.say(st.done ? (th.title || 'recipe') + ' is done' : 'next: ' + steps[st.idx].label);
        if (st.done) { th.running = false; th.elapsed = total; th.startedAt = 0; clearInterval(iv); stageApi.save(); stageApi.emit(th, { event: 'done', text: (th.title || 'the recipe') + ' is done' }); stageApi.render(); }
      }
    }, 250);
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const r = parseRecipe(text);
  if (!r) return '';
  addThing(stageApi, 'recipe', { title: r.title, steps: r.steps, elapsed: 0, running: false, startedAt: 0 });
  stageApi.save(); stageApi.render();
  return 'recipe-stack';
}

export default {
  name: 'recipe-stack',
  examples: ['cook pasta: boil 10 min then rest 2', 'make rice: simmer 15 min then rest 5 min'],
  nearMisses: ['cook pasta', 'how do I cook rice', 'add milk to my list'],
  parseRecipe,
  match(lower, text) { return !!parseRecipe(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'recipe-stack' : 'none'; },
  stageKinds: { recipe: { mount, ask } },
};
