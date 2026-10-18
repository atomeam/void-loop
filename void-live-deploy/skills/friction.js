/**
 * friction skill - a slider for how slippery things are (asked by Verse, 2026-10-16: "a 'drag-velocity' slider on the stage that
 * allows users to manually adjust the friction of moved objects"). "add a friction slider" puts one card on the stage: 0 is ice
 * (a thrown thing keeps its speed), 100 is mud (it stops almost at once); the default 5 is how the stage has always felt. The
 * setting is kept on this device (lib/state.js lists it) and void.html's throw reads it every time something is let go fast.
 * "set the friction to 80" does the same by word. "friction factor of a car tyre" and "friction in physics" are not this.
 */
const KEY = 'a2m.void.friction.v1', DEFAULT = 5;
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** { set: n|null } when the ask is about the stage's friction slider, else null. Pure. */
export function frictionOf(text) {
  const t = CLEAN(text);
  if (/^(?:(?:add|show|make|give me|open|put up)\s+(?:me\s+)?(?:a\s+|the\s+|my\s+)?)?(?:friction|drag(?:[- ]velocity)?)\s+slider$/.test(t) || /^how\s+slippery\s+are\s+(?:things|my\s+things|thrown\s+things)$/.test(t) || /^drag\s+friction$/.test(t)) return { set: null };
  const m = /^(?:set|change|make)\s+(?:the\s+)?(?:stage\s+)?friction\s+(?:to|at)\s+(\d{1,3})(?:\s*%)?$/.exec(t) || /^(?:friction|slippery)\s+(?:to\s+)?(\d{1,3})$/.exec(t);
  return m ? { set: Math.min(100, +m[1]) } : null;
}
/** the throw's speed kept each step for a setting 0..100. Pure. */
export const factorOf = (v) => 1 - Math.min(100, Math.max(0, Number.isFinite(+v) ? +v : DEFAULT)) / 1000;
const words = (v) => (v <= 1 ? 'ice: things keep sliding' : v <= 10 ? 'the usual' : v <= 40 ? 'grippy' : v <= 80 ? 'sticky' : 'mud: things stop almost at once');

export const read = () => { try { const v = parseFloat(localStorage.getItem(KEY)); return Number.isFinite(v) ? v : DEFAULT; } catch (_) { return DEFAULT; } };
export const keep = (v) => { try { localStorage.setItem(KEY, String(Math.round(v))); } catch (_) {} };

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing friction-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:220px;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(20,20,30,.75);font-size:12px';
  const v = read();
  const head = document.createElement('div'); head.textContent = 'friction';
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = String(v); slider.setAttribute('aria-label', 'friction of thrown things, 0 ice to 100 mud'); slider.style.cssText = 'width:100%';
  const out = document.createElement('div'); out.className = 'friction-out';
  const paint = (n) => { out.textContent = n + ' · ' + words(n) + ' · keeps ' + (factorOf(n) * 100).toFixed(1) + '% of its speed a step'; };
  paint(v);
  slider.addEventListener('pointerdown', (e) => e.stopPropagation());
  slider.addEventListener('input', () => { const n = +slider.value; keep(n); paint(n); });
  el.append(head, slider, out);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  const f = frictionOf(text);
  if (!f) return 'none';
  if (f.set != null) keep(f.set);
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'friction');
  if (existing) { if (f.set != null) api.stage.render(); else if (api.stage.center) api.stage.center(existing.id); } else api.summon('friction', { x: 40, y: 80 });
  api.say(f.set != null ? 'friction set to ' + f.set + ' · ' + words(f.set) : 'friction slider · 0 is ice, 100 is mud · throw something to feel it');
  return 'friction';
}

export default {
  name: 'friction',
  examples: ['add a friction slider', 'drag friction', 'how slippery are things', 'set the friction to 80'],
  nearMisses: ['friction factor of a car tyre', 'friction in physics', 'what is friction', 'slider puzzle'],
  match(lower, text) { return !!frictionOf(text || lower); },
  run,
  frictionOf, factorOf,
  stageKinds: { friction: { mount } },
};
