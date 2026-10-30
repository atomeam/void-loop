/**
 * backdrop skill: a pre-rendered scene behind the stage (owner, 2026-10-25: "a static, beautifully lit 2D painted scene with fixed camera angles, where
 * real-time elements like our little cartoon ... card or interactive utility cards project shadows and walk along defined floor meshes ... swap
 * pre-rendered backdrops depending on the rung or theme you're working on (a retro server room, a cyberpunk rooftop, or an atmospheric study) ...
 * the heavy lifting is baked into the background image").
 * "set the stage to a retro server room", "backdrop: a cyberpunk rooftop", "stage: an atmospheric study": the Art Forge paints the scene ONCE
 * (functions/api/card-art.js, kind 'backdrop', lib/art-rules.js backdropPrompt: a late-90s pre-rendered game background, one fixed camera, the floor in
 * the lower quarter, no text, no people; kept per scene for ever, counted in the day's cap, so one scene costs one picture, ever). The picture is a
 * layer behind every card (#void-scene, fixed, under #stage), cover-fit and bottom-anchored, so the walker's horizon (skills/walker.js, 24 px above
 * the ask bar) stands on the painted floor; every card on the stage casts a soft shadow downward onto it (a synced layer of shadows under the cards,
 * lib/backdrop.js shadowRect: never a filter on the cards, which would flatten the coin's and the game box's 3D). Remembered in this browser
 * (a2m.void.backdrop.v1: the picture and the ask) so it is there on the next visit; "clear the backdrop" brings the plain void back (and takes off a
 * drawing backdrop too, through the page's own void-backdrop event, as it did before). The atom-galaxy void stays the default: no scene ever loads unasked.
 */
import { backdropOf, sceneRecord, parseScene, shadowRect, STORE_KEY, SHADOW } from '../lib/backdrop.js';

const CSS = '#void-scene{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity 1.2s ease;overflow:hidden;background:#07070c}'
  + '#void-scene.on{opacity:1}'
  + '#void-scene img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 100%;display:block}' // cover-fit, the painted floor kept at the bottom
  + '#void-scene::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.22),transparent 30%,transparent 72%,rgba(0,0,0,.3))}' // a light vignette so the cards and the ask bar still read
  + '.scene-shadows{position:absolute;inset:0;pointer-events:none;z-index:0}'
  + '.scene-shadow{position:absolute;border-radius:18px;background:rgba(0,0,0,' + SHADOW.alpha + ');filter:blur(' + SHADOW.blur + 'px);transform:scale(.97,1.02)}'
  + '@media (prefers-reduced-motion:reduce){#void-scene{transition:none}}';

const WHY = {
  off: 'Painting is switched off on this copy of Verse, so the void stays.',
  cap: "Today's paintings are used up; ask again after midnight UTC and the scene gets painted.",
  busy: 'The painter did not answer just now. Ask again in a moment.',
  slow: 'Painting too fast; ask again in a minute.',
  brand: "I don't paint brands or famous places from films and games, only my own scenes.",
  person: "I don't paint people.",
  unsuitable: "I won't paint that one.",
  kept: "I won't paint that one.",
  secret: "That looks like a key or a secret, so I won't put it in a picture.",
  unreachable: "I couldn't reach the painter just now. Ask again in a moment.",
};
/** the line said when the forge gives no scene. Pure. */
export const whyLine = (why) => WHY[why] || 'No scene this time. Ask again in a moment.';

let on = null; // { layer, img, rec }
const stageEl = () => (typeof document === 'undefined' ? null : document.getElementById('stage'));
const read = () => { try { return parseScene(localStorage.getItem(STORE_KEY)); } catch (_) { return null; } };
const write = (rec) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (_) {} };
const forget = () => { try { localStorage.removeItem(STORE_KEY); } catch (_) {} };

function style() {
  if (document.getElementById('backdrop-css')) return;
  const s = document.createElement('style'); s.id = 'backdrop-css'; s.textContent = CSS; document.head.appendChild(s);
}

/** the shadows under the cards: one per thing on the stage, the thing's box SHADOW.dy lower, re-synced after every redraw and drag (decorate) */
function syncShadows(st) {
  let host = document.getElementById('scene-shadows');
  if (!on) { if (host) host.remove(); return; }
  if (!host) { host = document.createElement('div'); host.id = 'scene-shadows'; host.className = 'scene-shadows'; host.setAttribute('aria-hidden', 'true'); }
  if (!host.isConnected) st.prepend(host);
  const things = [...st.querySelectorAll(':scope > .thing[data-id]')];
  while (host.children.length > things.length) host.lastChild.remove();
  things.forEach((el, i) => {
    let s = host.children[i]; if (!s) { s = document.createElement('div'); s.className = 'scene-shadow'; host.appendChild(s); }
    const r = shadowRect({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    s.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px' + (el.hidden || el.classList.contains('shrunk') || !r.w ? ';display:none' : '');
  });
}

/** put the scene behind the stage from a record; replaces one already there */
function show(rec) {
  const st = stageEl(); if (!st) return null;
  style();
  let layer = document.getElementById('void-scene');
  if (!layer) { layer = document.createElement('div'); layer.id = 'void-scene'; layer.setAttribute('aria-hidden', 'true'); st.parentNode.insertBefore(layer, st); } // just under the stage: over the stars and a drawing backdrop
  let img = layer.querySelector('img');
  if (!img) { img = document.createElement('img'); img.alt = ''; img.draggable = false; layer.appendChild(img); }
  img.src = rec.src;
  layer.dataset.subject = rec.subject;
  on = { layer, img, rec };
  document.documentElement.dataset.scene = rec.subject || 'scene';
  requestAnimationFrame(() => layer.classList.add('on'));
  syncShadows(st);
  return on;
}

/** take the scene off: the void comes back */
function hide() {
  const was = !!on;
  if (on) { on.layer.classList.remove('on'); const l = on.layer; setTimeout(() => { if (!on || on.layer !== l) l.remove(); }, 1300); on = null; }
  delete document.documentElement.dataset.scene;
  const st = stageEl(); if (st) syncShadows(st);
  return was;
}

/** the scene painted once by the Art Forge: { img } or { why } */
async function paint(subject) {
  try {
    const r = await fetch('/api/card-art', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subject, kind: 'backdrop' }) });
    const j = await r.json();
    return j && j.state === 'art' && /^data:image\//.test(j.img || '') ? { img: j.img } : { why: (j && j.why) || 'busy' };
  } catch (_) { return { why: 'unreachable' }; }
}

/** after every stage redraw and every drag move (the page calls decorate(stageApi)): the shadows follow the cards */
export function decorate() { const st = stageEl(); if (st) syncShadows(st); }

/** "clear the backdrop": this scene goes and is forgotten; a drawing backdrop (skills/draw.js) goes too, through the page's own event, as it always did */
export function clearScene(api) {
  const was = hide() || !!read();
  forget();
  try { window.dispatchEvent(new CustomEvent('void-backdrop', { detail: { src: '' } })); } catch (_) {}
  if (api && api.say) api.say(was ? 'the void is back' : 'no backdrop is on');
  return was;
}

async function run(text, api) {
  const hit = backdropOf(text);
  if (!hit) return 'none';
  if (hit.clear) { clearScene(api); return 'backdrop'; }
  if (api.say) api.say('painting a ' + hit.subject + ' scene · the first time takes a minute');
  const r = await paint(hit.subject);
  if (!r.img) { if (api.say) api.say(whyLine(r.why)); return 'backdrop'; }
  const rec = sceneRecord({ src: r.img, subject: hit.subject, ask: text });
  if (!rec.src) { if (api.say) api.say(whyLine('busy')); return 'backdrop'; }
  show(rec); write(rec);
  if (api.say) api.say('the stage is a ' + hit.subject + ' now · "clear the backdrop" brings the void back');
  return 'backdrop';
}

/** the scene kept from last time comes back as soon as the stage is there (asked for on an earlier visit; never unasked) */
function restore() {
  if (typeof document === 'undefined' || on) return;
  const rec = read(); if (!rec) return;
  const go = () => { const st = stageEl(); if (!st) return false; if (!on) show(rec); return true; };
  if (go()) return;
  const t0 = Date.now(), tick = () => { if (!go() && Date.now() - t0 < 15000) setTimeout(tick, 250); }; tick();
}
if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById && document.getElementById('stage')) setTimeout(restore, 0);

export default {
  name: 'backdrop',
  examples: ['set the stage to a retro server room', 'backdrop: a cyberpunk rooftop', 'stage: an atmospheric study', 'clear the backdrop', 'paint a backdrop of a rainy harbour at night', 'set the scene to a quiet library'],
  nearMisses: ['make it my backdrop', 'what is a backdrop', 'remove my backdrop', 'set a timer for 5 minutes', 'stage a play', 'the stage'],
  backdropOf,
  whyLine,
  clearScene,
  decorate,
  match(lower, text) { return !!backdropOf(text || lower); },
  run,
  suite() {
    const a = backdropOf('set the stage to a retro server room'), b = backdropOf('clear the backdrop');
    const ok = !!a && a.subject === 'retro server room' && !!b && b.clear === true && backdropOf('make it my backdrop') === null && backdropOf('what is a backdrop') === null && whyLine('cap').includes('used up');
    return { ok, got: a && a.subject };
  }
};
