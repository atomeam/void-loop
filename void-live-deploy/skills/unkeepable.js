/**
 * unkeepable skill - something that cannot be kept (owner, 2026-10-18, the Opposite Era; made with tools/new-skill.mjs).
 * "make me something unkeepable" puts one thing on the stage that lives 60 s and fades as it goes. It is never written to the
 * stage save (an `ephemeral` kind the page's keptThings() leaves out, so a reload, a sync and an undo snapshot never carry it),
 * and any attempt to keep it shatters it at once: its own keep / copy / save buttons, copying its words (the copy event),
 * Ctrl/Cmd+C, +S or +P while it is the picked thing, or dragging its text out. The page's own "keep this" works on the open
 * answer card, never on a stage thing, so it cannot keep this either. The pure parts (unkeepableOf, opacityAt, shardsOf, trapOf,
 * phraseOf) are tested in tools/stage-pack-f.test.mjs.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** the ask wants an unkeepable thing. Pure. */
export function unkeepableOf(text) {
  const t = CLEAN(text);
  return /^(?:please\s+)?(?:make|give|show|conjure|summon|create)\s+(?:me\s+)?(?:something|a\s+thing|one\s+thing|an\s+object)\s+(?:(?:that\s+)?(?:is\s+)?unkeepable|(?:that\s+)?(?:i\s+)?(?:can(?:no|')t|cannot)\s+(?:be\s+)?(?:kept|keep|save[d]?|copied|copy))$/.test(t)
    || /^(?:please\s+)?(?:make|give|show|conjure|summon|create)\s+(?:me\s+)?(?:an\s+)?unkeepable(?:\s+(?:thing|object|card))?$/.test(t)
    || /^(?:something|the)\s+unkeepable$/.test(t);
}
export const LIFE_MS = 60000;
/** how visible it is at `age` ms into its life: 1 at birth, fading to 0.06 at the end. Pure. */
export const opacityAt = (age, life = LIFE_MS) => { const t = Math.min(1, Math.max(0, age / life)); return Math.round((1 - 0.94 * t * t) * 1000) / 1000; };
/** n shards for a seed: where each flies { dx, dy, rot, delay }, the same for the same seed. Pure. */
export function shardsOf(seed, n = 14) {
  let a = (Math.floor(+seed) >>> 0) || 1; const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; for (let i = 0; i < n; i++) { const ang = (i / n) * 6.2832 + r() * 0.5, d = 60 + r() * 120; out.push({ dx: Math.round(Math.cos(ang) * d), dy: Math.round(Math.sin(ang) * d + 40), rot: Math.round((r() - 0.5) * 240), delay: Math.round(r() * 80) }); }
  return out;
}
/** what a keep attempt an event is: 'copy' (a copy event, Ctrl/Cmd+C, a drag out), 'save' (Ctrl/Cmd+S or +P), 'keep' (its button), or null. Pure. */
export function trapOf(e) {
  if (!e) return null;
  if (e.type === 'copy' || e.type === 'cut' || e.type === 'dragstart') return 'copy';
  if (e.type === 'button') return e.name === 'keep' ? 'keep' : e.name === 'save' ? 'save' : e.name === 'copy' ? 'copy' : null;
  if (e.type === 'keydown' && (e.ctrlKey || e.metaKey)) { const k = String(e.key || '').toLowerCase(); if (k === 'c' || k === 'x') return 'copy'; if (k === 's' || k === 'p') return 'save'; }
  return null;
}
const PHRASES = ['a thought you almost had', 'the last second of a sunset', 'a word on the tip of your tongue', 'the smell of rain before it falls', 'a dream at the moment of waking', 'the shape of a wave', 'a laugh you did not expect', 'the warmth of a cup just finished'];
/** the words on it, by seed. Pure. */
export const phraseOf = (seed) => PHRASES[Math.abs(Math.floor(+seed) || 0) % PHRASES.length];

// ---- the stage ------------------------------------------------------------------------------------------------------------------
let live = null; // { th, stageApi, timer } for the one unkeepable up now
const elOf = (st, id) => st.stage.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(id)) : id) + '"]');
const sayWhy = { keep: 'it shattered: that one could not be kept', copy: 'it shattered: that one could not be copied', save: 'it shattered: that one could not be saved', time: 'it faded: that one was never yours to keep' };
function gone(stageApi, th, why) {
  if (live && live.th === th) { clearInterval(live.timer); live = null; }
  const things = stageApi.things(); if (things[th.id]) delete things[th.id];
  if (stageApi.selected() === th.id) stageApi.select(null);
  stageApi.save(); stageApi.render(); stageApi.say(sayWhy[why] || sayWhy.keep);
}
/** shatter it now: the card breaks into shards that fly off, then it is gone from the stage */
export function shatter(stageApi, th, why = 'keep') {
  if (th.shattering) return; th.shattering = true;
  const el = elOf(stageApi, th.id);
  if (el && typeof el.animate === 'function') {
    const r = el.getBoundingClientRect(), words = (th.text || '').split(/\s+/), shards = shardsOf(th.seed);
    el.style.visibility = 'hidden';
    shards.forEach((s, i) => {
      const p = document.createElement('span'); p.className = 'unkeepable-shard'; p.textContent = words[i % words.length] || '·'; p.setAttribute('aria-hidden', 'true');
      p.style.cssText = 'position:fixed;left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;font-size:12px;color:#d8e8ff;pointer-events:none;z-index:40';
      document.body.appendChild(p);
      p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + s.dx + 'px,' + s.dy + 'px) rotate(' + s.rot + 'deg)', opacity: 0 }], { duration: 650, delay: s.delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).onfinish = () => p.remove();
    });
  }
  setTimeout(() => gone(stageApi, th, why), el ? 420 : 0);
}
function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing unkeepable-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:220px;padding:12px 14px;border-radius:14px;background:radial-gradient(circle at 30% 20%,rgba(120,160,255,.35),rgba(20,24,48,.85));border:1px solid rgba(180,200,255,.45);color:#e8eeff;font-size:14px;line-height:1.45;box-shadow:0 0 24px rgba(120,160,255,.25);opacity:' + opacityAt(Date.now() - th.born) + ';transition:opacity .5s linear';
  el.draggable = false;
  const words = document.createElement('div'); words.className = 'unkeepable-words'; words.textContent = th.text || phraseOf(th.seed);
  const left = document.createElement('div'); left.className = 'unkeepable-left sub'; left.style.cssText = 'margin-top:8px;font-size:11px;opacity:.8';
  left.textContent = 'gone in ' + Math.max(0, Math.ceil((th.born + LIFE_MS - Date.now()) / 1000)) + ' s · cannot be kept';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin-top:8px';
  for (const name of ['keep', 'copy', 'save']) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'unkeepable-' + name; b.textContent = name; b.title = 'try it';
    b.style.cssText = 'font:inherit;font-size:11px;letter-spacing:.08em;padding:3px 9px;border-radius:7px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:inherit;cursor:pointer';
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); shatter(stageApi, th, trapOf({ type: 'button', name })); });
    row.appendChild(b);
  }
  el.append(words, left, row);
  el.addEventListener('dragstart', (e) => { e.preventDefault(); shatter(stageApi, th, 'copy'); });
  el.addEventListener('pointerdown', () => stageApi.select(th.id));
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}
function watch(stageApi, th) {
  if (live) { clearInterval(live.timer); }
  live = { th, stageApi, timer: setInterval(() => {
    if (!stageApi.things()[th.id]) { clearInterval(live && live.timer); if (live && live.th === th) live = null; return; }
    const age = Date.now() - th.born, el = elOf(stageApi, th.id);
    if (age >= LIFE_MS) { if (el) el.style.opacity = '0'; setTimeout(() => gone(stageApi, th, 'time'), 500); clearInterval(live.timer); return; }
    if (el) { el.style.opacity = String(opacityAt(age)); const l = el.querySelector('.unkeepable-left'); if (l) l.textContent = 'gone in ' + Math.ceil((LIFE_MS - age) / 1000) + ' s · cannot be kept'; }
  }, 500) };
}
// the page's own ways of taking a copy, trapped once for whichever unkeepable is up: the copy event with a selection inside it (or it picked),
// Ctrl/Cmd+C, +X, +S, +P while it is the picked thing
if (typeof document !== 'undefined' && !globalThis.__voidUnkeepableTrap) {
  globalThis.__voidUnkeepableTrap = true;
  const inside = (node) => { for (let n = node; n; n = n.parentNode) if (n.classList && n.classList.contains('unkeepable-card')) return true; return false; };
  const picked = () => !!(live && live.stageApi.selected() === live.th.id);
  document.addEventListener('copy', (e) => { if (!live) return; const sel = document.getSelection(); if ((sel && sel.rangeCount && inside(sel.anchorNode)) || inside(e.target) || picked()) { e.preventDefault(); shatter(live.stageApi, live.th, 'copy'); } });
  document.addEventListener('cut', (e) => { if (live && (inside(e.target) || picked())) { e.preventDefault(); shatter(live.stageApi, live.th, 'copy'); } });
  document.addEventListener('keydown', (e) => { if (!live || !picked()) return; const why = trapOf(e); if (why) { if (why === 'save') e.preventDefault(); shatter(live.stageApi, live.th, why); } });
}

async function run(text, api) {
  if (!unkeepableOf(text)) return 'none';
  const st = api.stage, things = st.things();
  for (const t of Object.values(things)) if (t && t.kind === 'unkeepable') delete things[t.id]; // one at a time
  const stage = st.stage, seed = (Date.now() % 1000003) >>> 0;
  const th = { id: 'unkeepable_' + Math.random().toString(36).slice(2, 9), kind: 'unkeepable', x: Math.max(20, Math.round((stage.clientWidth || 800) / 2 - 110)), y: Math.max(20, Math.round((stage.clientHeight || 600) / 2 - 70)), born: Date.now(), seed, text: phraseOf(seed) };
  things[th.id] = th; st.select(th.id);
  st.save(); st.render(); watch(st, th);
  api.say('here: it lives a minute and fades, and any keep, copy or save shatters it');
  return 'unkeepable';
}

export default {
  name: 'unkeepable',
  examples: ['make me something unkeepable', 'give me something that cannot be kept', 'something unkeepable', 'conjure an unkeepable thing'],
  nearMisses: ['keep this', 'make me something to eat', 'what does unkeepable mean', 'save this', 'make me a sticky note'],
  match(lower, text) { return unkeepableOf(text); },
  run,
  stageKinds: { unkeepable: { mount, ephemeral: true } },
};
