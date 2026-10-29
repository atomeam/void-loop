/**
 * flow-canvas skill — F-033, the Adaptive Flow-Canvas (asked by Owner, 2026-10-17; Grok's idea on the field minds kit, lib/field-kit.js).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }, made with lib/field-stage.js fieldSkill.
 * Ink tracers ride a 16 x 16 vector field you can paint. A small evolutionary mind (a Worker, or the page itself when workers are blocked)
 * keeps mutating the field's magnitude, direction and spatial frequency and keeps what scores better: trajectory diversity plus how
 * well the field answers your pointer. The pointer pours a Gaussian swirl; the ink's shapes stretch and sharpen with local velocity (CSS
 * border-radius, size, rotation); the card morphs with the field's entropy; the Sound button turns the flow into a Web Audio drone.
 * The law is lib/field-flow.js (tools/field-flow.test.mjs); the Worker plumbing is lib/field-worker.js.
 */
import { fieldSkill } from '../lib/field-stage.js';
import { spawnMind } from '../lib/field-worker.js';
import * as F from '../lib/field-flow.js';

const BLOBS = 10;

function draw(g, s, W, H) {
  g.fillStyle = '#05040c'; g.fillRect(0, 0, W, H);
  const cw = W / F.G, ch = H / F.G;
  g.lineWidth = 1; g.strokeStyle = s.editing ? 'rgba(140,200,255,.5)' : 'rgba(140,160,255,.1)'; g.beginPath();
  for (let j = 0; j < F.G; j++) for (let i = 0; i < F.G; i++) {
    const n = j * F.G + i, ax = (s.total.u[n] / 0.5) * cw * 0.45, ay = (s.total.v[n] / 0.5) * ch * 0.45, x = (i + 0.5) * cw, y = (j + 0.5) * ch;
    g.moveTo(x - ax, y - ay); g.lineTo(x + ax, y + ay);
  }
  g.stroke();
  const n = F.activeCount(s.ink), alpha = 0.25 + 0.55 * s.ink, p = s.p;
  g.lineCap = 'round'; g.lineWidth = 0.8 + 1.4 * s.ink;
  for (let b = 0; b < 3; b++) {
    g.strokeStyle = 'hsla(' + (190 + b * 55) + ',85%,' + (58 + b * 6) + '%,' + alpha + ')'; g.beginPath();
    for (let i = 0; i < n; i++) {
      if (Math.min(2, Math.floor(Math.hypot(p.vx[i], p.vy[i]) / 0.5 * 3)) !== b) continue;
      const dx = p.x[i] - s.px[i], dy = p.y[i] - s.py[i]; if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) continue;
      g.moveTo((p.x[i] - dx * 3) * W, (p.y[i] - dy * 3) * H); g.lineTo(p.x[i] * W, p.y[i] * H);
    }
    g.stroke();
  }
  if (s.ui) s.ui(s);
}

const idea = {
  id: 'flow-canvas', title: 'Adaptive Flow-Canvas', sub: 'F-033 · v' + F.VERSION, W: 360, H: 270, warm: 20, perFrame: 1,
  how: 'Drag across the ink to pour a swirl. "Edit field" then drag paints the flow by hand. A small mind keeps mutating the field and keeps what spreads the ink best and answers you.',
  create: F.createFlow, step: F.stepFlow, metrics: F.metricsFlow, draw,
  params: (s) => ({ version: F.VERSION, mag: s.params.mag, dir: s.params.dir, freq: s.params.freq, ink: s.ink, edited: F.editedCells(s.edits), gen: s.gen }),
  status: (s, m) => 'gen ' + s.gen + ' · fit ' + s.fit.toFixed(2) + ' · ' + s.improved + ' kept · ' + F.editedCells(s.edits) + ' cells painted · ' + Math.round(m.entropy * 100) + '% spread · mind: ' + s.mode,
  mount({ el, q, th, input, cv, redraw, still }) {
    const S = () => th.state;
    el.dataset.version = 'f033-' + F.VERSION;
    const row = document.createElement('div'); row.className = 'ff-flowctl'; row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px;font-size:12px';
    row.innerHTML = '<label style="display:flex;gap:6px;align-items:center">Ink <input type="range" class="ff-ink-range" min="0" max="100" value="60" aria-label="Ink density" style="width:110px"></label>'
      + '<button type="button" class="g-btn ff-edit" aria-pressed="false">Edit field</button><button type="button" class="g-btn ff-clearedit">Clear edits</button>';
    q('.ff-btns').insertAdjacentElement('afterend', row);
    for (const n of row.querySelectorAll('input,button')) n.addEventListener('pointerdown', (e) => e.stopPropagation());
    const slider = q('.ff-ink-range'), editB = q('.ff-edit');
    slider.addEventListener('input', () => { S().ink = (+slider.value || 0) / 100; el.dataset.ink = String(S().ink); if (still()) redraw(); });
    editB.addEventListener('click', () => { const s = S(); s.editing = !s.editing; editB.setAttribute('aria-pressed', String(s.editing)); editB.textContent = s.editing ? 'Editing: drag to paint' : 'Edit field'; cv.style.cursor = s.editing ? 'copy' : 'crosshair'; redraw(); });
    q('.ff-clearedit').addEventListener('click', () => { const s = S(); s.edits.u.fill(0); s.edits.v.fill(0); redraw(); });

    // painting: while editing, a drag pushes the cells under it along the drag
    let last = null;
    cv.addEventListener('pointerdown', () => { last = { x: input.x, y: input.y }; });
    cv.addEventListener('pointermove', () => {
      const s = S(); if (!s.editing || !input.down || !last) { last = input.down ? { x: input.x, y: input.y } : null; return; }
      const dx = input.x - last.x, dy = input.y - last.y, d = Math.hypot(dx, dy); if (d < 0.004) return;
      F.paintEdit(s.edits, input.x, input.y, (dx / d) * 0.3, (dy / d) * 0.3); last = { x: input.x, y: input.y }; if (still()) redraw();
    });

    // the ink shapes: CSS shape-morphing from each tracer's local velocity
    const frame = q('.ff-frame'); frame.style.position = 'relative';
    const layer = document.createElement('div'); layer.className = 'ff-inks'; layer.setAttribute('aria-hidden', 'true'); layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    const blobs = Array.from({ length: BLOBS }, () => { const b = document.createElement('i'); b.style.cssText = 'position:absolute;left:0;top:0;display:block;mix-blend-mode:screen;will-change:transform'; layer.appendChild(b); return b; });
    frame.appendChild(layer);
    const ui = (s) => {
      for (let k = 0; k < BLOBS; k++) {
        const sh = F.inkShape(s.p.vx[k], s.p.vy[k], s.ink), b = blobs[k];
        b.style.width = sh.w + 'px'; b.style.height = sh.h + 'px'; b.style.borderRadius = sh.radius; b.style.opacity = String(0.15 + 0.5 * s.ink);
        b.style.background = 'hsl(' + Math.round(200 + sh.speed * 110) + ',85%,65%)';
        b.style.transform = 'translate(' + (s.p.x[k] * layer.clientWidth).toFixed(1) + 'px,' + (s.p.y[k] * layer.clientHeight).toFixed(1) + 'px) translate(-50%,-50%) rotate(' + sh.rot + 'deg)';
        if (k === 0) { el.dataset.inkradius = sh.radius; el.dataset.inkspeed = String(sh.speed); }
      }
    };
    const attach = () => { const s = S(); s.ui = ui; s.ink = (+slider.value || 0) / 100; };
    attach(); q('.ff-reset').addEventListener('click', () => { attach(); editB.setAttribute('aria-pressed', 'false'); editB.textContent = 'Edit field'; });

    // the mind: one generation about every 1.3 s, in a Worker when it can, on the page when it cannot
    const mind = spawnMind('/lib/field-flow.js', 'evolveFlow', F.evolveFlow);
    S().mode = mind.mode; el.dataset.mind = mind.mode; let busy = false, seq = 0;
    function dispose() { clearInterval(timer); mind.close(); }
    const think = () => {
      if (!el.isConnected) { dispose(); return; }
      if (busy || document.hidden || still()) return;
      const s = S(); busy = true;
      const msg = { params: s.params, edits: { u: Float32Array.from(s.edits.u), v: Float32Array.from(s.edits.v) }, seed: ((s.seed + 7919 * (++seq)) >>> 0) || 1, pointer: input.over ? { x: input.x, y: input.y } : null, cands: 4, sigma: 0.15, gen: s.gen };
      mind.call(msg).then((res) => { const cur = S(); F.adoptMind(cur, res); cur.mode = mind.mode; el.dataset.mind = mind.mode; el.dataset.gen = String(cur.gen); }, () => { S().mode = 'main'; }).finally(() => { busy = false; });
    };
    const timer = setInterval(think, 1300);
    return { dispose };
  }
};

export default fieldSkill({
  name: 'flow-canvas',
  words: '(?:adaptive\\s+)?flow[\\s-]?canvas|adaptive\\s+flow(?:[\\s-]?field)?|(?:an?\\s+)?(?:evolving|painted|paintable)\\s+flow\\s+field|f[\\s-]?033|render\\s+.*(landscape|scene|flow)',
  examples: ['flow canvas', 'adaptive flow canvas', 'show me the adaptive flow canvas', 'open the flow canvas', 'render a landscape'],
  nearMisses: ['flow chart', 'cash flow', 'flow of traffic', 'what is a flow field', 'air flow in a room', 'flow state'],
  idea,
  say: 'the flow canvas is here: drag to swirl the ink, "Edit field" to paint the flow'
});
