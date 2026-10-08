/**
 * figure skill — little 3D things that live on the stage (domains/forethinkers/figures-first.md).
 * "a chair" or "a cup" puts a small 3D one on the stage; "summon motelet" brings Motelet, an original character, who
 * uses what is already there: it sits on a free chair, else picks up a free cup, else stands and looks around.
 * Things stay, existing on the stage, until thrown off the screen with the mouse (void.html: stageKinds, throwable).
 * Drag Motelet onto a chair or a cup and it uses that; the mouse wheel over a thing spins it; "spin it" turns it around.
 * "download motelet" (or the STL button under it) saves the same body as a print file, in the pose it has on the stage.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), stageKinds }. No network, no libraries.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

const OBJECT_RE = /^(?:please\s+)?(?:(?:summon|add|put|place|make|give|show|get|bring)(?:\s+me)?\s+)?(?:a|an|one|the)?\s*(?:(?:little|tiny|small|3d|wooden)\s+)*(chair|cup|mug|book|lamp)(?:\s+(?:on|to)\s+the\s+stage)?$/;
const FIGURE_RE = /^(?:please\s+)?(?:(?:summon|add|bring|show(?:\s+me)?|make|put|get|call|where\s+is)\s+)?(?:motelet|(?:a|the|one)\s+figure)(?:\s+(?:on|to)\s+the\s+stage)?$/;
const SPIN_RE = /^(?:spin|turn|rotate)\s+(?:motelet|it|the\s+(?:chair|cup|mug|figure|book|lamp))(?:\s+(?:around|round))?$/;
const EXPORT_RE = /^(?:download|export|print|save)\s+(?:the\s+)?motelet(?:'s)?(?:\s+(?:stl|file|print\s+file|body))?$|^motelet\s+(?:stl|print\s+file)$/;

// Motelet remembers you, on this device (domains/void.growth.md, Next [think-tank]): the first time it is summoned it
// asks your name; it keeps the name, and once you have given it the last thing you summoned, in this browser only
// (localStorage, never sent anywhere). Next visit it greets you by name and asks after that thing. "Motelet, forget me"
// or "forget my name" clears it ("forget me" alone stays the account's: it deletes passkeys and synced data).
export const MEM_KEY = 'a2m.motelet.memory.v1';
export function loadMem() { try { const m = JSON.parse(localStorage.getItem(MEM_KEY) || 'null'); return m && typeof m.name === 'string' && m.name ? m : null; } catch (_) { return null; } }
function saveMem(m) { try { if (m) localStorage.setItem(MEM_KEY, JSON.stringify(m)); else localStorage.removeItem(MEM_KEY); } catch (_) {} }
let asking = false; // Motelet just asked for a name: the next ask may be the answer (only the next one)
const FORGET_RE = /^(?:motelet,?\s+forget\s+(?:me|my\s+name|who\s+i\s+am)|forget\s+my\s+name)$/;
const NAME_RE = /^(?:my\s+name\s+is|my\s+name's|i'?m|i\s+am|call\s+me|it'?s|this\s+is)\s+([a-z][a-z'-]{0,19}(?:\s+[a-z][a-z'-]{0,19})?)$/;
const NOT_NAMES = new Set(['clear', 'menu', 'undo', 'close', 'help', 'hi', 'hello', 'hey', 'yes', 'no', 'ok', 'okay', 'thanks', 'stop', 'quiet', 'nothing', 'nevermind', 'motelet', 'fine', 'good', 'here', 'back']);
export function nameOf(text, original) {
  const t = CLEAN(text); let m = t.match(NAME_RE), raw = null;
  // a bare word is a name only when written like one ("Sam"): lowercase "weather" stays an ask for the rest of Void
  if (m) raw = m[1]; else if (/^[a-z][a-z'-]{1,19}$/.test(t) && !NOT_NAMES.has(t) && /^[A-Z]/.test(String(original || '').trim())) raw = t;
  if (!raw) return null;
  const src = String(original || raw).trim().replace(/[?!.]+$/, ''), tail = src.slice(src.length - raw.length); // keep the person's own capitals
  return (tail.toLowerCase() === raw ? tail : raw).split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
export function setAsking(v) { asking = !!v; }

export function parseAsk(text) {
  const t = CLEAN(text);
  let m;
  if (FORGET_RE.test(t)) return { act: 'forget' };
  if ((m = t.match(OBJECT_RE))) return { act: 'object', model: m[1] === 'mug' ? 'cup' : m[1] };
  if (FIGURE_RE.test(t)) return { act: 'figure' };
  if (SPIN_RE.test(t)) return { act: 'spin', what: (t.match(/chair|cup|mug|book|lamp/) || [''])[0].replace('mug', 'cup') };
  if (EXPORT_RE.test(t)) return { act: 'export' };
  if (asking) { const name = nameOf(t, text); if (name) return { act: 'name', name }; }
  return null;
}

// ---------- bodies, in millimetres: Z up, the front faces -Y ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// each primitive is one closed shell with outward faces (counter-clockwise seen from outside)
function ellipsoid(c, r, color, nu = 20, nv = 12) {
  const P = (i, j) => { const u = (2 * Math.PI * (i % nu)) / nu, v = -Math.PI / 2 + (Math.PI * j) / nv;
    return j === 0 ? [c[0], c[1], c[2] - r[2]] : j === nv ? [c[0], c[1], c[2] + r[2]]
      : [c[0] + r[0] * Math.cos(v) * Math.cos(u), c[1] + r[1] * Math.cos(v) * Math.sin(u), c[2] + r[2] * Math.sin(v)]; };
  const tris = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = P(i, j), b = P(i + 1, j), d = P(i + 1, j + 1), e = P(i, j + 1);
    if (j > 0) tris.push([a, b, d]);
    if (j < nv - 1) tris.push([a, d, e]);
  }
  return { color, tris };
}
function cylinder(a, b, r, color, n = 14) {
  const u = norm(sub(b, a)), helper = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = norm(cross(helper, u)), e2 = cross(u, e1);
  const ring = (c) => Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n; return add(c, add(scale(e1, r * Math.cos(t)), scale(e2, r * Math.sin(t)))); });
  const A = ring(a), B = ring(b), tris = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push([A[i], A[j], B[j]], [A[i], B[j], B[i]], [b, B[i], B[j]], [a, A[j], A[i]]);
  }
  return { color, tris };
}
function box(x0, x1, y0, y1, z0, z1, color) {
  const p = (x, y, z) => [x, y, z], tris = [];
  const quad = (a, b, c, d) => { tris.push([a, b, c], [a, c, d]); };
  quad(p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), p(x1, y0, z0));
  quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1));
  quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1));
  quad(p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0));
  quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0));
  quad(p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1));
  return { color, tris };
}

const WOOD = '#b07a4a', CUP = '#ece6da', CUPBAND = '#ff7a59';
const BOOK = '#b0483e', PAGES = '#f2ead8', LAMPON = '#f2c14e', POLE = '#4a4a52';
export const CHAIR = { seat: 12, half: 8 }; // seat top 12 mm, 16 x 16 mm

export function chairParts() {
  const { seat, half } = CHAIR, L = 1.6, out = [box(-half, half, -half, half, seat - 1.5, seat, WOOD), box(-half, half, half - 1.6, half, seat, seat + 18, WOOD)];
  for (const [x, y] of [[-half, -half], [half - L, -half], [-half, half - L], [half - L, half - L]]) out.push(box(x, x + L, y, y + L, 0, seat - 1.5, WOOD));
  return out;
}
export function cupParts(at = [0, 0, 0]) {
  const [x, y, z] = at;
  return [cylinder([x, y, z], [x, y, z + 7], 3, CUP), cylinder([x, y, z + 4.6], [x, y, z + 5.8], 3.15, CUPBAND),
    box(x - 4.9, x - 2.6, y - 0.6, y + 0.6, z + 5.2, z + 6.2, CUP), box(x - 4.9, x - 2.6, y - 0.6, y + 0.6, z + 1.4, z + 2.4, CUP),
    box(x - 4.9, x - 3.9, y - 0.6, y + 0.6, z + 2.4, z + 5.2, CUP)];
}

export function bookParts() { // a closed paperback, 16 x 11 x 4 mm
  return [box(-8, 8, -5.5, 5.5, 0, 3.2, BOOK), box(-7.4, 7.4, -5, 5, 0.6, 2.8, PAGES), box(-8.4, -7.6, -5.5, 5.5, 0, 3.2, BOOK)];
}

export function lampParts() { // a small desk lamp: round base, pole, drum shade, 22 mm
  return [cylinder([0, 0, 0], [0, 0, 1.6], 4.5, POLE), cylinder([0, 0, 1.6], [0, 0, 15], 0.9, POLE), cylinder([0, 0, 13.4], [0, 0, 20.5], 4.8, LAMPON)];
}

// Motelet: 38 mm tall standing. One personality: curious and polite; it always sits when it finds a chair.
const MINT = '#8fd3c1', LIMB = '#5aa897', FOOT = '#3d6f64', EYE = '#1b1b1b', CHEEK = '#f29b8a', ANT = '#ff7a59';
export const MOTELET = { name: 'Motelet', height: 38, personality: 'curious and polite; it sits whenever it finds a chair and lifts its cup a little when it is happy' };

export function moteletParts(pose = 'stand') {
  const sit = pose === 'sit', H = sit ? [0, 1, CHAIR.seat + 1.7] : [0, 0, 11.3], at = (d) => add(H, d), parts = [];
  parts.push(ellipsoid(at([0, 0, 4.5]), [6.2, 4.8, 6.2], MINT)); // body
  const C = at([0, 0, 15.5]);
  parts.push(ellipsoid(C, [8.2, 8.2, 8.2], MINT, 24, 14)); // head
  for (const sx of [-1, 1]) {
    parts.push(ellipsoid(add(C, [sx * 3.0, -7.3, 1.0]), [1.35, 1.0, 1.6], EYE));
    parts.push(ellipsoid(add(C, [sx * 5.0, -6.0, -1.3]), [1.4, 0.8, 1.0], CHEEK));
  }
  parts.push(ellipsoid(add(C, [0, -7.9, -2.4]), [1.6, 0.6, 0.5], EYE)); // smile
  parts.push(cylinder(at([0, 0, 23.2]), at([0, 0, 25.2]), 0.45, LIMB, 8), ellipsoid(at([0, 0, 25.6]), [1.1, 1.1, 1.1], ANT)); // antenna
  for (const sx of [-1, 1]) { // legs
    const hip = at([sx * 3, 0, 0]);
    if (sit) {
      const knee = at([sx * 3.2, -8, 0]), ankle = at([sx * 3.3, -9, -8.2]);
      parts.push(cylinder(hip, knee, 1.9, LIMB), ellipsoid(knee, [2, 2, 2], LIMB), cylinder(knee, ankle, 1.8, LIMB), ellipsoid(add(ankle, [0, -1.4, -0.9]), [2.4, 3.4, 1.3], FOOT));
    } else {
      const knee = [sx * 3.1, 0, 6.8], ankle = [sx * 3.2, 0, 2.4];
      parts.push(cylinder(hip, knee, 1.9, LIMB), ellipsoid(knee, [2, 2, 2], LIMB), cylinder(knee, ankle, 1.8, LIMB), ellipsoid([sx * 3.3, -1.2, 1.3], [2.4, 3.6, 1.3], FOOT));
    }
  }
  for (const sx of [-1, 1]) { // arms: the +x hand lifts forward to hold a cup
    const sh = at([sx * 6, 0, 7.5]), hand = pose === 'hold' && sx > 0 ? at([5.6, -7.2, 6.2]) : at([sx * 7.8, -0.8, sit ? 1.6 : 0.8]);
    parts.push(cylinder(sh, hand, 1.5, LIMB), ellipsoid(hand, [1.9, 1.9, 1.9], MINT));
  }
  return parts;
}
export const HOLD_CUP_AT = [5.6 + 4.4, -7.2, 11.3 + 6.2 - 3.8]; // the cup's base: its handle (x -4.9..-2.6, z 1.4..6.2) closes on the raised hand

export function bodyFor(th, things) {
  if (th.model === 'chair') return chairParts();
  if (th.model === 'cup') return cupParts();
  if (th.model === 'book') return bookParts();
  if (th.model === 'lamp') return lampParts();
  const pose = th.on && things[th.on] ? 'sit' : th.holds && things[th.holds] ? 'hold' : 'stand';
  const parts = moteletParts(pose);
  return pose === 'hold' ? parts.concat(cupParts(HOLD_CUP_AT)) : parts;
}

/** The print file: Motelet as it is on the stage. Seated, it sits on a print stool; a held cup stays on the stage. */
export function moteletSTL(pose = 'stand') {
  const parts = moteletParts(pose);
  if (pose === 'sit') parts.push(box(-6, 6, -4, 6, 0, CHAIR.seat + 0.2, MINT));
  const f = (v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(4)).toString(), lines = ['solid motelet'];
  for (const p of parts) for (const [a, b, c] of p.tris) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    lines.push(' facet normal ' + n.map(f).join(' '), '  outer loop', ...[a, b, c].map((v) => '   vertex ' + v.map(f).join(' ')), '  endloop', ' endfacet');
  }
  lines.push('endsolid motelet');
  return lines.join('\n') + '\n';
}

// ---------- drawing: one camera for every thing, so a seated figure lands exactly on its seat ----------
const PX = 4, ELEV = (18 * Math.PI) / 180, CE = Math.cos(ELEV), SE = Math.sin(ELEV);
const LIGHT = norm([-0.45, -0.75, 0.6]);
function project(v, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw), X = v[0] * c - v[1] * s, Y = v[0] * s + v[1] * c;
  return [PX * X, -PX * (v[2] * CE + Y * SE), Y * CE - v[2] * SE];
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), ch = (x) => Math.max(0, Math.min(255, Math.round(x * k)));
  return 'rgb(' + ch(n >> 16) + ',' + ch((n >> 8) & 255) + ',' + ch(n & 255) + ')';
}
/** Projected, lit, back-face-culled triangles sorted far to near, and their screen box relative to the world origin. */
export function drawList(parts, yaw = 0) {
  const out = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const p of parts) for (const [a, b, d] of p.tris) {
    const n0 = cross(sub(b, a), sub(d, a));
    if (!Math.hypot(...n0)) continue;
    const n = norm([n0[0] * c - n0[1] * s, n0[0] * s + n0[1] * c, n0[2]]);
    if (n[1] * CE - n[2] * SE >= 0) continue; // faces away from the camera
    const P = [a, b, d].map((v) => project(v, yaw));
    for (const q of P) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
    out.push({ P, z: (P[0][2] + P[1][2] + P[2][2]) / 3, fill: shade(p.color, 0.42 + 0.68 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2])) });
  }
  out.sort((x, y) => y.z - x.z);
  return { tris: out, box: [Math.floor(minX) - 3, Math.floor(minY) - 3, Math.ceil(maxX) + 3, Math.ceil(maxY) + 3] };
}

function saveFile(name, text) {
  const blob = new Blob([text], { type: 'model/stl' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function ensureStyle() {
  if (document.getElementById('fig3d-style')) return;
  const st = document.createElement('style');
  st.id = 'fig3d-style';
  st.textContent = '.fig3d{position:absolute;cursor:grab;user-select:none;touch-action:none;background:none;border:0;padding:0}'
    + '.fig3d canvas{display:block}.fig3d.idle canvas{animation:fig3d-breathe 3.2s ease-in-out infinite}'
    + '@keyframes fig3d-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}'
    + '.fig3d .fig3d-stl{position:absolute;right:0;bottom:-18px;font:11px ui-sans-serif,system-ui,sans-serif;color:var(--muted,#8a8a8a);background:none;border:0;cursor:pointer;opacity:.55;padding:0}'
    + '.fig3d:hover .fig3d-stl{opacity:1}';
  document.head.appendChild(st);
}

// where a thing's world origin sits on the screen; a seated figure shares its chair's
function anchorOf(th, things) {
  const chair = th.on && things[th.on];
  if (chair) return { ax: chair.ax, ay: chair.ay, yaw: chair.yaw || 0 };
  return { ax: th.ax, ay: th.ay, yaw: th.yaw || 0 };
}

function mount(th, S) {
  const things = S.things();
  if (th.heldBy && things[th.heldBy]) return; // a held cup is drawn in the hand
  ensureStyle();
  if (th.ax == null) { th.ax = th.x; th.ay = th.y; }
  const { ax, ay, yaw } = anchorOf(th, things);
  const { tris, box: [x0, y0, x1, y1] } = drawList(bodyFor(th, things), yaw);
  const k = 1 + 0.45 * Math.max(0, Math.min(3, Number(th.lod) || 0)); // "zoom in on the figure" (skills/zoom-figure.js) draws it bigger, sharp, around its feet
  const w = (x1 - x0) * k, h = (y1 - y0) * k, dpr = Math.min(2, window.devicePixelRatio || 1);
  th.x = ax + x0 * k; th.y = ay + y0 * k; th.bx = x0 * k; th.by = y0 * k;
  const el = document.createElement('div');
  el.className = 'thing fig3d' + (th.model === 'motelet' && !th.on ? ' idle' : '');
  el.dataset.id = th.id; el.dataset.model = th.model; el.dataset.pose = th.model === 'motelet' ? (th.on && things[th.on] ? 'sit' : th.holds && things[th.holds] ? 'hold' : 'stand') : '';
  el.style.left = th.x + 'px'; el.style.top = th.y + 'px';
  el.title = th.model === 'motelet' ? 'Motelet: ' + MOTELET.personality + '. Throw it off the screen to send it away.' : 'a little ' + th.model + ' · throw it off the screen to send it away';
  const cv = document.createElement('canvas');
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const g = cv.getContext('2d');
  if (g) {
    g.scale(dpr * k, dpr * k); g.translate(-x0, -y0); g.lineJoin = 'round';
    for (const t of tris) {
      g.beginPath(); g.moveTo(t.P[0][0], t.P[0][1]); g.lineTo(t.P[1][0], t.P[1][1]); g.lineTo(t.P[2][0], t.P[2][1]); g.closePath();
      g.fillStyle = t.fill; g.strokeStyle = t.fill; g.lineWidth = 0.6; g.fill(); g.stroke();
    }
  }
  el.appendChild(cv);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); spin(th, S, e.deltaY > 0 ? 30 : -30); }, { passive: false });
  if (th.model === 'motelet') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fig3d-stl'; b.textContent = 'STL'; b.setAttribute('aria-label', 'download Motelet as a print file');
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => exportFigure(th, S.things()));
    el.appendChild(b);
  }
  S.bindDrag(el, th);
  S.stage.appendChild(el);
}

function spin(th, S, deg) {
  const things = S.things(), target = th.on && things[th.on] ? things[th.on] : th; // a seated figure turns with its chair
  target.yaw = ((target.yaw || 0) + (deg * Math.PI) / 180) % (2 * Math.PI);
  S.save(); S.render();
}

function exportFigure(th, things) {
  const pose = th.on && things[th.on] ? 'sit' : th.holds && things[th.holds] ? 'hold' : 'stand';
  saveFile('motelet' + (pose === 'stand' ? '' : '-' + pose) + '.stl', moteletSTL(pose));
  return pose;
}

const free = (things, model, me) => Object.values(things).find((t) => t.kind === 'fig3d' && t.model === model
  && !Object.values(things).some((o) => o !== me && o.kind === 'fig3d' && (o.on === t.id || o.holds === t.id)));

// put a figure to use: a free chair first, else a free cup; nothing free, it stands where it is
function settle(fig, things) {
  if (fig.holds && things[fig.holds]) { const cup = things[fig.holds]; delete cup.heldBy; cup.ax = fig.ax + 60; cup.ay = fig.ay; }
  fig.on = null; fig.holds = null;
  const chair = free(things, 'chair', fig);
  if (chair) { fig.on = chair.id; delete things[fig.id]; things[fig.id] = fig; return 'sits on the chair'; } // drawn after its chair
  const cup = free(things, 'cup', fig);
  if (cup && !cup.heldBy) { fig.holds = cup.id; cup.heldBy = fig.id; return 'picks up the cup'; }
  return 'looks around';
}

function near(a, b) { return Math.hypot((a.ax || 0) - (b.ax || 0), (a.ay || 0) - (b.ay || 0)) < 70; }

function dropped(th, S) {
  const things = S.things();
  th.ax = th.x - (th.bx || 0); th.ay = th.y - (th.by || 0);
  if (th.model === 'chair') { // its sitter moves with it, and stays drawn in front
    for (const f of Object.values(things)) if (f.kind === 'fig3d' && f.on === th.id) { delete things[f.id]; things[f.id] = f; }
    return;
  }
  if (th.model !== 'motelet') return;
  if (th.on && things[th.on]) { // pulled off its chair: it stands where it was dropped
    if (!near(th, things[th.on])) th.on = null; else { th.ax = things[th.on].ax; th.ay = things[th.on].ay; return; }
  }
  const target = Object.values(things).find((t) => t.kind === 'fig3d' && t !== th && (t.model === 'chair' || (t.model === 'cup' && !t.heldBy)) && near(th, t)
    && !Object.values(things).some((o) => o !== th && (o.on === t.id || o.holds === t.id)));
  if (target && target.model === 'chair') { if (th.holds && things[th.holds]) { const cup = things[th.holds]; delete cup.heldBy; cup.ax = th.ax + 60; cup.ay = th.ay; th.holds = null; } th.on = target.id; delete things[th.id]; things[th.id] = th; }
  else if (target && target.model === 'cup' && !th.holds) { th.holds = target.id; target.heldBy = th.id; }
}

function thrown(th, S) {
  const things = S.things();
  for (const t of Object.values(things)) { // whatever it used stays on the stage
    if (t.heldBy === th.id) { delete t.heldBy; t.ax = th.ax; t.ay = th.ay; }
    if (t.on === th.id) { t.on = null; t.ax = th.ax; t.ay = th.ay; } // a sitter stays where its chair was
    if (t.holds === th.id) t.holds = null;
  }
}

function lastOf(things, pred) { const all = Object.values(things).filter(pred); return all[all.length - 1] || null; }

async function run(text, api) {
  const ask = parseAsk(text);
  if (!ask) return 'none';
  const S = api.stage, things = S && S.things();
  if (!S || !api.summon) return 'none';
  const W = S.stage.clientWidth || innerWidth, Hh = S.stage.clientHeight || innerHeight;
  // the first free spot, from the middle outwards, so a new thing never lands on top of one already there
  const spot = () => {
    const taken = Object.values(S.things()).filter((t) => t.kind === 'fig3d' && !t.heldBy).map((t) => anchorOf(t, S.things()));
    for (let k = 0; k < 24; k++) {
      const ax = Math.round(W / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 120), ay = Math.round(Hh * 0.62) - Math.floor(k / 8) * 150;
      if (ax > 40 && ax < W - 40 && !taken.some((t) => Math.abs(t.ax - ax) < 100 && Math.abs(t.ay - ay) < 120)) return { ax, ay };
    }
    return { ax: Math.round(W / 2), ay: Math.round(Hh * 0.62) };
  };
  if (ask.act === 'object') {
    const mem = loadMem(); if (mem) saveMem({ ...mem, last: ask.model }); // remembered only for someone who gave their name
    const p = spot();
    const th = api.summon('fig3d', { model: ask.model, x: p.ax, y: p.ay, ax: p.ax, ay: p.ay, yaw: 0 });
    // a figure standing with nothing to do uses the new thing
    const idle = lastOf(S.things(), (t) => t.kind === 'fig3d' && t.model === 'motelet' && !t.on && !t.holds);
    if (idle && th) { const did = settle(idle, S.things()); S.save(); S.render(); api.say('a little ' + ask.model + ' · Motelet ' + did); }
    else api.say('a little ' + ask.model + ' · throw it off the screen to send it away');
    return th ? 'figure:' + ask.model : 'none';
  }
  if (ask.act === 'figure') {
    const p = spot();
    const fig = api.summon('fig3d', { model: 'motelet', x: p.ax, y: p.ay, ax: p.ax, ay: p.ay, yaw: 0 });
    if (!fig) return 'none';
    const did = settle(fig, S.things());
    S.save(); S.render();
    const mem = loadMem();
    if (mem) api.say('Motelet ' + did + ' · hi ' + mem.name + (mem.last ? ', did you bring the ' + mem.last + ' back?' : ', good to see you again'));
    else { asking = true; api.say('Motelet ' + did + ' · hi, I\'m Motelet. what\'s your name? ("I\'m Sam")'); }
    return 'figure:motelet';
  }
  if (ask.act === 'name') {
    asking = false; saveMem({ name: ask.name, last: null });
    api.say('nice to meet you, ' + ask.name + ' · Motelet will remember, in this browser only ("Motelet, forget me" clears it)');
    return 'figure:name';
  }
  if (ask.act === 'forget') {
    const had = loadMem(); saveMem(null); asking = false;
    api.say(had ? 'Motelet forgets you: your name and your last summon are gone from this browser' : 'Motelet has nothing of yours to forget');
    return 'figure:forget';
  }
  if (ask.act === 'spin') {
    const target = ask.what ? lastOf(things, (t) => t.kind === 'fig3d' && t.model === ask.what) : lastOf(things, (t) => t.kind === 'fig3d' && t.model === 'motelet') || lastOf(things, (t) => t.kind === 'fig3d');
    if (!target) { api.say('nothing to spin yet: try “summon motelet”'); return 'none'; }
    spin(target, S, 180);
    api.say('turned around');
    return 'figure:spin';
  }
  if (ask.act === 'export') {
    const fig = lastOf(things, (t) => t.kind === 'fig3d' && t.model === 'motelet');
    const pose = exportFigure(fig || {}, things);
    api.say(pose === 'sit' ? 'motelet-sit.stl: Motelet seated, on a print stool' : pose === 'hold' ? 'motelet-hold.stl: Motelet holding out its hand' : 'motelet.stl: Motelet standing, 38 mm');
    return 'figure:export';
  }
  return 'none';
}

export default {
  name: 'figure',
  examples: [
    'summon motelet',
    'motelet',
    'a chair',
    'summon a cup',
    'a book',
    'summon a lamp',
    'put a little chair on the stage',
    'spin motelet',
    'spin the figure',
    'download motelet',
    'summon a figure',
    'a figure',
    'motelet, forget me',
    'forget my name',
  ],
  nearMisses: [
    'world cup',
    'what is a chair',
    'how many cups in a liter',
    'chair yoga',
    'summon linemote-1',
    'what is a figure of speech',
    'forget me',
    'sam',
    'my name is sam',
  ],
  match(lower, text) { const a = parseAsk(text); if (asking && (!a || a.act !== 'name')) asking = false; return !!a; },
  run,
  stageKinds: { fig3d: { mount, dropped, thrown, throwable: true } },
};
