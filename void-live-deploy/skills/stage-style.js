/**
 * stage-style skill — how cards and the stage look (owner, 2026-10-18, "tools pack 4", items 71 to 80 of the list):
 * "set opacity to 50%" / "make the clock 30% transparent" (71), "tint the clock red" (72), "border weight 3" (73), "round the corners" / "corner radius 10" (74),
 * "add a shadow to the clock" / "shadow off" (75), "set the background to #112233" / "make the background green" (76),
 * "use a picture from my files as the background" (77: a chooser, the picture is shrunk on this device and kept as the backdrop the page already has),
 * "blur the background" (78), "high contrast mode" (79), "larger type mode" (80: the page's own text size, 40% up; "bigger text" was already live).
 * A card style is a small `fx` record on the card, saved with the stage and drawn after every redraw; it acts on the multi-selection, else the picked card,
 * else the kind named ("tint the clocks red"). Nothing is sent anywhere; a picked image never leaves the device.
 */
import { styleOf, fxStyle, withFx, solidLook } from '../lib/stage-tools.js';
import { read, write, targets, plural, whenReady, STAGE_KEY } from '../lib/stage-tools-dom.js';

const FX_KEY = 'a2m.void.stylefx.v1';
const gfx = () => ({ blur: 0, hc: false, ...read(FX_KEY, {}) });
let lastApi = null;

const CSS = `
html[data-hc="on"]{--void-bg:#000;--fg:#fff;--muted:#e8e8e8;--line:#fff;color-scheme:dark}
html[data-hc="on"] body{background:#000;color:#fff}
html[data-hc="on"] #void-backdrop,html[data-hc="on"] #void-stars,html[data-hc="on"] #void-stars-far,html[data-hc="on"] #void-glow,html[data-hc="on"] #void-depth,html[data-hc="on"] #void-aura{opacity:0!important}
html[data-hc="on"] #stage>[data-id]{background:#000!important;color:#fff!important;border:2px solid #fff!important;box-shadow:none!important;opacity:1!important}
html[data-hc="on"] #stage a{color:#ff6!important}
html[data-hc="on"] :focus-visible{outline:3px solid #ff0!important;outline-offset:2px}
html[data-hc="on"] #input{background:#000!important;color:#fff!important;border:2px solid #fff!important}
html[data-bgblur] #void-backdrop,html[data-bgblur] #void-stars,html[data-bgblur] #void-stars-far,html[data-bgblur] #void-glow{filter:blur(var(--bgblur,8px))!important}`;

/** the global looks (high contrast, background blur) on the page now */
export function applyGlobal() {
  if (typeof document === 'undefined') return;
  const g = gfx(), d = document.documentElement;
  if (!document.getElementById('stage-style-css')) { const s = document.createElement('style'); s.id = 'stage-style-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (g.hc) d.dataset.hc = 'on'; else delete d.dataset.hc;
  if (g.blur > 0) { d.dataset.bgblur = String(g.blur); d.style.setProperty('--bgblur', g.blur + 'px'); } else { delete d.dataset.bgblur; d.style.removeProperty('--bgblur'); }
}
/** draw each card's fx record on the card */
function paintFx(stageEl, things) {
  for (const el of stageEl.querySelectorAll(':scope > [data-id]')) {
    const t = things[el.dataset.id]; if (!t || !t.fx) continue;
    const s = fxStyle(t.fx); for (const k of Object.keys(s)) if (s[k] !== '') el.style[k] = s[k];
    el.dataset.fx = '1';
  }
}
function decorate(stageApi) { lastApi = { stage: stageApi }; paintFx(stageApi.stage, stageApi.things()); }
if (typeof document !== 'undefined' && !window.__voidStyleBoot) {
  window.__voidStyleBoot = true;
  whenReady(() => {
    applyGlobal();
    const st = document.getElementById('stage'); if (!st) return;
    let queued = 0; // a redraw that came before any ask: the saved stage is read straight from this device
    new MutationObserver(() => { if (queued) return; queued = requestAnimationFrame(() => { queued = 0; try { paintFx(st, lastApi ? lastApi.stage.things() : JSON.parse(localStorage.getItem(STAGE_KEY) || '{}') || {}); } catch (_) {} }); }).observe(st, { childList: true });
  });
}

const lookEvent = (detail) => { try { window.dispatchEvent(new CustomEvent('void-look', { detail })); } catch (_) {} };

/** shrink a picked image on this device to a backdrop the page keeps (jpeg, under 600 KB as text) */
export async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('not an image')); i.src = url; });
    let scale = Math.min(1, 1280 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1)), q = 0.8;
    for (let tries = 0; tries < 8; tries++) {
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const src = c.toDataURL('image/jpeg', q);
      if (src.length < 560000) return src;
      if (q > 0.5) q -= 0.1; else scale *= 0.8;
    }
    return '';
  } finally { URL.revokeObjectURL(url); }
}
function chooser(api) {
  if (document.getElementById('stage-bg-pick')) return;
  const bar = document.createElement('div'); bar.id = 'stage-bg-pick'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Choose a background image');
  bar.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:7;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(20,18,34,.92);border:1px solid rgba(255,255,255,.25);color:#eee;font:13px system-ui,sans-serif';
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.setAttribute('aria-label', 'Choose an image from this device for the background');
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close the chooser'); close.style.cssText = 'cursor:pointer;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;border-radius:999px;padding:2px 9px';
  const msg = document.createElement('span'); msg.className = 'bg-pick-msg'; msg.textContent = 'stays on this device';
  close.addEventListener('click', () => bar.remove());
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0]; if (!f) return;
    if (!/^image\//.test(f.type)) { msg.textContent = 'that is not an image'; return; }
    msg.textContent = 'shrinking…';
    let src = ''; try { src = await shrinkImage(f); } catch (_) {}
    if (!src) { msg.textContent = 'could not use that image · try a smaller one'; return; }
    window.dispatchEvent(new CustomEvent('void-backdrop', { detail: { src } }));
    bar.remove(); api.say('background set · "remove the backdrop" takes it off');
  });
  bar.append(input, msg, close);
  document.body.appendChild(bar);
}

const PROP_SAY = { opacity: (v) => 'opacity ' + v + '%', tint: (v) => (v ? 'tinted' : 'tint removed'), border: (v) => 'border ' + v + ' px', radius: (v) => 'corners ' + v + ' px', shadow: (v) => (v ? 'shadow on' : 'shadow off') };

function run(text, api) {
  const h = styleOf(text);
  if (!h) return 'none';
  lastApi = { stage: api.stage };
  const say = api.say || (() => {}), things = api.stage.things();
  if (h.op === 'fx' || h.op === 'reset') {
    if (!Object.keys(things).length) { say('the stage is empty · put something on it first'); return 'stage-style'; }
    const ids = targets(api, h.who, true);
    if (!ids.length) { say('pick a card first, or say which: "tint the clocks red"'); return 'stage-style'; }
    for (const id of ids) {
      const t = things[id]; if (!t) continue;
      if (h.op === 'reset') delete t.fx; else { const fx = withFx(t.fx, h.prop, h.value); if (fx) t.fx = fx; else delete t.fx; }
    }
    api.stage.save(); api.stage.render();
    say((h.op === 'reset' ? 'style cleared' : PROP_SAY[h.prop](h.value)) + ' on ' + plural(ids.length, 'card'));
    return 'stage-style';
  }
  if (h.op === 'bg') {
    const look = h.color ? solidLook(h.color) : { bg: '#050505', glow: '#0b0b10' };
    lookEvent(look); say(h.color ? 'background ' + h.color : 'background back to the default');
    return 'stage-style';
  }
  if (h.op === 'bgimage') { chooser(api); say('choose an image · it is shrunk here and never leaves this device'); return 'stage-style'; }
  if (h.op === 'blur') { write(FX_KEY, { ...gfx(), blur: h.px }); applyGlobal(); say(h.px ? 'background blurred ' + h.px + ' px' : 'background sharp again'); return 'stage-style'; }
  if (h.op === 'contrast') { write(FX_KEY, { ...gfx(), hc: h.on }); applyGlobal(); say(h.on ? 'high contrast on · say "turn off high contrast" to go back' : 'high contrast off'); return 'stage-style'; }
  if (h.op === 'type') { lookEvent({ scale: h.on ? 1.4 : 1 }); say(h.on ? 'larger type on · say "turn off larger type mode" to go back' : 'type size normal'); return 'stage-style'; }
  return 'none';
}

export default {
  name: 'stage-style',
  styleOf,
  examples: ['set opacity to 50%', 'make the clock 30% transparent', 'tint the clock red', 'border weight 3', 'round the corners', 'corner radius 10', 'add a shadow to the clock',
    'shadow off', 'set the background to #112233', 'make the background green', 'use a picture from my files as the background', 'blur the background', 'high contrast mode',
    'turn off high contrast', 'larger type mode'],
  nearMisses: ['what is opacity', 'tint my car windows', 'border collie puppies', 'tax bracket for 2026', 'shadow of the colossus', 'background check for a job', 'blur the face in my photo',
    'high contrast colors for a website', 'make my void blue', 'bigger text'],
  match(lower, text) { return !!styleOf(text || lower); },
  run,
  decorate,
};
