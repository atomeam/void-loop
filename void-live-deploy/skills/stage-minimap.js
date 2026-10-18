/**
 * stage-minimap skill — corner overlay so a dense stage stays navigable.
 * "show minimap", "hide minimap", "toggle minimap", "is the minimap on".
 * Dots are color-coded by kind. Click a region to pan the main stage.
 * Updates are event-driven (void:dropped / void:moved), not a 60fps loop.
 * Empty surface stays empty: overlay is hidden when there are zero things.
 */

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

const MAP_W = 140;
const MAP_H = 100;
const PAD = 12;

const KIND_COLOR = {
  sticky: '#e0a24a',
  note: '#e0a24a',
  clock: '#5b8def',
  timer: '#5b8def',
  counter: '#3fbf6a',
  kept: '#b07ce8',
  card: '#b07ce8',
  figure: '#f2f2f7',
  shape: '#8a8a92',
  default: '#6a6a78',
};

/** Parse ask → { action: 'show'|'hide'|'toggle'|'status' } or null. */
export function minimapOf(text) {
  const t = CLEAN(text);
  if (/^(?:show|open|enable|turn on)\s+(?:the\s+)?(?:stage\s+)?minimap$/.test(t) || /^minimap\s+on$/.test(t)) {
    return { action: 'show' };
  }
  if (/^(?:hide|close|disable|turn off)\s+(?:the\s+)?(?:stage\s+)?minimap$/.test(t) || /^minimap\s+off$/.test(t)) {
    return { action: 'hide' };
  }
  if (/^toggle\s+(?:the\s+)?(?:stage\s+)?minimap$/.test(t)) {
    return { action: 'toggle' };
  }
  if (/^(?:is\s+(?:the\s+)?)?(?:stage\s+)?minimap\s+on$/.test(t) || /^minimap\s+status$/.test(t)) {
    return { action: 'status' };
  }
  return null;
}

let lastStage = null;
let visible = false;
let mapEl = null;
let canvas = null;
let bound = false;

export function decorate(st) {
  if (st && st.things) lastStage = st;
}

function ensureDom() {
  if (mapEl) return mapEl;
  mapEl = document.createElement('div');
  mapEl.id = 'void-stage-minimap';
  mapEl.setAttribute('aria-label', 'Stage minimap');
  mapEl.style.cssText =
    'position:fixed;right:' + PAD + 'px;bottom:' + PAD + 'px;width:' + MAP_W + 'px;height:' + MAP_H +
    'px;z-index:40;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.14);' +
    'background:rgba(10,10,16,0.82);backdrop-filter:blur(6px);box-shadow:0 8px 24px rgba(0,0,0,0.4);' +
    'display:none;cursor:pointer;touch-action:none';
  canvas = document.createElement('canvas');
  canvas.width = MAP_W * 2;
  canvas.height = MAP_H * 2;
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  mapEl.appendChild(canvas);
  mapEl.addEventListener('click', onMapClick);
  document.body.appendChild(mapEl);
  return mapEl;
}

function boundsOf(boxes) {
  if (!boxes.length) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const pad = 40;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function collectBoxes(st) {
  const out = [];
  if (!st || !st.things) return out;
  const things = st.things();
  const root = st.stage;
  for (const t of Object.values(things || {})) {
    if (!t || !t.id) continue;
    let x = Number(t.x) || 0;
    let y = Number(t.y) || 0;
    let w = 80, h = 60;
    if (root && root.querySelector) {
      const el = root.querySelector(
        '[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(t.id) : t.id) + '"]'
      );
      if (el) {
        x = el.offsetLeft;
        y = el.offsetTop;
        w = el.offsetWidth || w;
        h = el.offsetHeight || h;
      }
    }
    out.push({ id: t.id, kind: t.kind || t.type || 'default', x, y, w, h });
  }
  return out;
}

function redraw(st) {
  if (!visible || !canvas) return;
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(8,8,14,0.9)';
  g.fillRect(0, 0, W, H);

  const boxes = collectBoxes(st || lastStage);
  if (!boxes.length) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.font = '20px ui-sans-serif, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('empty', W / 2, H / 2 + 6);
    return;
  }

  const b = boundsOf(boxes);
  const spanX = Math.max(1, b.maxX - b.minX);
  const spanY = Math.max(1, b.maxY - b.minY);
  const scale = Math.min(W / spanX, H / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;

  // viewport rectangle (visible stage area approx)
  const root = (st || lastStage) && (st || lastStage).stage;
  if (root) {
    const vw = root.clientWidth || window.innerWidth;
    const vh = root.clientHeight || window.innerHeight;
    const scrollX = root.scrollLeft || 0;
    const scrollY = root.scrollTop || 0;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.strokeRect(
      ox + (scrollX - b.minX) * scale,
      oy + (scrollY - b.minY) * scale,
      vw * scale,
      vh * scale
    );
  }

  for (const box of boxes) {
    const cx = ox + (box.x + box.w / 2 - b.minX) * scale;
    const cy = oy + (box.y + box.h / 2 - b.minY) * scale;
    g.fillStyle = KIND_COLOR[box.kind] || KIND_COLOR.default;
    g.beginPath();
    g.arc(cx, cy, 5, 0, Math.PI * 2);
    g.fill();
  }

  // stash scale for click mapping
  mapEl._voidMap = { b, scale, ox, oy, W, H };
}

function onMapClick(ev) {
  const st = lastStage;
  if (!st || !mapEl || !mapEl._voidMap) return;
  const { b, scale, ox, oy, W, H } = mapEl._voidMap;
  const rect = mapEl.getBoundingClientRect();
  const mx = ((ev.clientX - rect.left) / rect.width) * W;
  const my = ((ev.clientY - rect.top) / rect.height) * H;
  const worldX = b.minX + (mx - ox) / scale;
  const worldY = b.minY + (my - oy) / scale;

  const root = st.stage;
  if (root && typeof root.scrollTo === 'function') {
    const vw = root.clientWidth || window.innerWidth;
    const vh = root.clientHeight || window.innerHeight;
    root.scrollTo({
      left: Math.max(0, worldX - vw / 2),
      top: Math.max(0, worldY - vh / 2),
      behavior: 'smooth',
    });
  } else if (typeof st.panTo === 'function') {
    st.panTo(worldX, worldY);
  } else if (typeof window.scrollTo === 'function') {
    window.scrollTo({
      left: Math.max(0, worldX - window.innerWidth / 2),
      top: Math.max(0, worldY - window.innerHeight / 2),
      behavior: 'smooth',
    });
  }
  redraw(st);
}

function onStageEvent() {
  if (visible) redraw(lastStage);
}

function bindEvents() {
  if (bound || typeof document === 'undefined') return;
  bound = true;
  document.addEventListener('void:dropped', onStageEvent);
  document.addEventListener('void:moved', onStageEvent);
}

function show(st, say) {
  ensureDom();
  bindEvents();
  visible = true;
  mapEl.style.display = 'block';
  const n = st && st.things ? Object.keys(st.things() || {}).length : 0;
  redraw(st);
  if (say) say(n === 0 ? 'minimap on · stage is empty' : 'minimap on · tap a dot to pan');
}

function hide(say) {
  visible = false;
  if (mapEl) mapEl.style.display = 'none';
  if (say) say('minimap off');
}

async function run(text, api) {
  const want = minimapOf(text);
  if (!want) return 'none';

  const st = api.stage || lastStage;
  const say = (s) => { if (api.say) api.say(s); };

  if (want.action === 'status') {
    say(visible ? 'minimap is on' : 'minimap is off');
    return 'stage-minimap';
  }
  if (want.action === 'hide') {
    hide(say);
    return 'stage-minimap';
  }
  if (want.action === 'toggle') {
    if (visible) hide(say);
    else show(st, say);
    return 'stage-minimap';
  }
  // show
  show(st, say);
  return 'stage-minimap';
}

export default {
  name: 'stage-minimap',
  decorate,
  examples: [
    'show minimap',
    'hide minimap',
    'toggle minimap',
    'is the minimap on',
    'show the stage minimap',
  ],
  nearMisses: [
    'minimap of paris',
    'google maps',
    'show the map',
    'weather map',
    'family gravity',
  ],
  match(lower, text) {
    return !!minimapOf(text || lower);
  },
  run,
  minimapOf,
  suite() {
    const a = minimapOf('show minimap');
    const b = minimapOf('hide minimap');
    const c = minimapOf('toggle minimap');
    const d = minimapOf('is the minimap on');
    const e = minimapOf('google maps');
    return {
      ok:
        !!a && a.action === 'show' &&
        !!b && b.action === 'hide' &&
        !!c && c.action === 'toggle' &&
        !!d && d.action === 'status' &&
        e === null,
    };
  },
};
