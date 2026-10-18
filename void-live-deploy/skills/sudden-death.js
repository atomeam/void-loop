/**
 * sudden-death skill - one countdown over the stage, and at zero one thing is gone (asked by the owner, 2026-10-18, stage pack E, the
 * Opposite Era). "sudden death in 60 seconds" (any number of seconds; "sudden death" alone is 60) puts one banner at the top of the
 * stage counting down; at zero one random thing that nobody kept (a kept card, one marked keep, or one put where it is by hand is
 * safe; lib/opposite-era.js isSafe) dissolves and is removed. Nothing removable: the banner says so and goes. "cancel sudden death"
 * takes the banner down with nothing lost. One countdown at a time: a new one replaces it. The banner is never saved (ephemeral).
 * "sudden death overtime rules" and "sudden cardiac death causes" are not this. The picks are pure and tested in tools/stage-pack-e.test.mjs.
 */
import { removable, pickOne, nameOf, elOf, stillness } from '../lib/opposite-era.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
export const DEFAULT_S = 60, MAX_S = 3600;
/** { act: 'start', seconds } | { act: 'cancel' } | null. Pure. */
export function suddenOf(text) {
  const t = CLEAN(text);
  let m = /^(?:start\s+|begin\s+)?sudden\s+death(?:\s+(?:in|after)\s+(\d{1,4})\s*(?:s|sec|secs|second|seconds))?(?:\s+(?:on\s+the\s+stage|now))?$/.exec(t);
  if (m) return { act: 'start', seconds: Math.min(MAX_S, Math.max(1, m[1] ? +m[1] : DEFAULT_S)) };
  m = /^sudden\s+death\s+in\s+(?:a|one|1)\s+minute$/.exec(t);
  if (m) return { act: 'start', seconds: 60 };
  if (/^(?:(?:cancel|stop|call\s+off|end|abort)\s+(?:the\s+)?sudden\s+death|sudden\s+death\s+(?:off|cancelled|canceled))$/.test(t)) return { act: 'cancel' };
  return null;
}
/** the id taken at zero: one at random of what may be taken (never the banner, never a kept thing), or null. Pure. */
export const victimOf = (things, r = Math.random) => pickOne(removable(things), r);
/** the banner's words for ms left. Pure. */
export const faceOf = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return { num: String(s), sub: s === 0 ? 'now' : s === 1 ? 'one second' : s + ' seconds' }; };

let timer = 0, stageRef = null;
const banner = (st) => Object.values(st.things()).find((t) => t && t.kind === 'sudden-death') || null;
function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing sudden-death'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:180px;padding:8px 12px;text-align:center;border-radius:14px;border:2px solid #ff4d4d;background:rgba(40,0,0,.82);color:#fff;cursor:default;box-shadow:0 0 24px rgba(255,60,60,.5)';
  el.setAttribute('role', 'timer'); el.setAttribute('aria-label', 'sudden death countdown');
  const head = document.createElement('div'); head.textContent = 'sudden death'; head.style.cssText = 'font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8';
  const num = document.createElement('div'); num.className = 'sd-num'; num.style.cssText = 'font-size:40px;font-weight:200;line-height:1.1';
  const sub = document.createElement('div'); sub.className = 'sd-sub'; sub.style.cssText = 'font-size:11px;opacity:.7';
  const f = faceOf(th.endAt - Date.now()); num.textContent = f.num; sub.textContent = f.sub;
  el.append(head, num, sub);
  stageApi.stage.appendChild(el);
}
function tick() {
  const st = stageRef; if (!st) return;
  const b = banner(st); if (!b) { clearInterval(timer); timer = 0; return; }
  const left = b.endAt - Date.now(), f = faceOf(left);
  const el = elOf(st, b.id);
  if (el) { const n = el.querySelector('.sd-num'), s = el.querySelector('.sd-sub'); if (n) n.textContent = f.num; if (s) s.textContent = f.sub; }
  if (left > 0) return;
  clearInterval(timer); timer = 0;
  strike(st);
}
/** zero: one thing goes (a dissolve, then it is removed and the stage saved); the banner goes with it. What was said. */
export function strike(st) {
  const things = st.things(), b = banner(st), id = victimOf(things);
  const finish = (line) => { if (b) delete things[b.id]; if (id) { delete things[id]; if (st.selected() === id) st.select(null); } st.save(); st.render(); st.say(line); };
  if (!id) { finish('sudden death: nothing to take · everything here is kept'); return 'nothing'; }
  const line = 'sudden death: the ' + nameOf(things[id]) + ' is gone';
  const el = elOf(st, id);
  if (el && typeof el.animate === 'function' && !stillness()) {
    const a = el.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(10px)', transform: 'scale(.7) rotate(8deg)' }], { duration: 700, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => finish(line); a.oncancel = () => finish(line);
  } else finish(line);
  return id;
}
/** the countdown of n seconds: a new banner, replacing any old one */
export function arm(st, seconds) {
  const things = st.things(), old = banner(st); if (old) delete things[old.id];
  const w = st.stage.clientWidth || 800;
  const th = { id: 'sudden-death-' + Date.now().toString(36), kind: 'sudden-death', x: Math.max(8, Math.round(w / 2 - 90)), y: 12, endAt: Date.now() + seconds * 1000 };
  things[th.id] = th; stageRef = st;
  st.save(); st.render();
  clearInterval(timer); timer = setInterval(tick, 250);
  return th;
}
export function disarm(st) {
  const things = st.things(), old = banner(st);
  clearInterval(timer); timer = 0;
  if (!old) return false;
  delete things[old.id]; st.save(); st.render();
  return true;
}

async function run(text, api) {
  const want = suddenOf(text);
  if (!want) return 'none';
  const st = api.stage;
  if (want.act === 'cancel') { api.say(disarm(st) ? 'sudden death called off · nothing lost' : 'no sudden death is running'); return 'sudden-death'; }
  const n = removable(st.things()).length;
  arm(st, want.seconds);
  api.say('sudden death in ' + want.seconds + ' second' + (want.seconds === 1 ? '' : 's') + ' · ' + (n ? n + ' thing' + (n === 1 ? '' : 's') + ' at risk · "cancel sudden death" calls it off' : 'nothing here can be taken, everything is kept'));
  return 'sudden-death';
}

export default {
  name: 'sudden-death',
  examples: ['sudden death in 60 seconds', 'cancel sudden death'],
  nearMisses: ['sudden death overtime rules', 'sudden cardiac death causes', 'sudden death in hockey'],
  match(lower, text) { return !!suddenOf(text || lower); },
  run,
  suddenOf, victimOf, faceOf,
  stageKinds: { 'sudden-death': { mount, ephemeral: true } },
};
