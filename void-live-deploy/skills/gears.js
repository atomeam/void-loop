/**
 * gears skill — explainer.gear-pair (domains/void.explainers.md), the first living miniature: two meshing gears you turn
 * by dragging either one, with tooth counts you change and a card that explains what you see. Every number comes from
 * skills/gear-pair-rules.js (one authoritative state; tests in tools/explainers.test.mjs). The pair stands in the void in
 * 3D (skills/mini/gears.js, lifted by lift3d.js with this card beside it); the flat drawing here is the fallback.
 * "explain gears", "show me two gears I can turn", "make one gear turn twice as fast", "what happens with 12 teeth and 24 teeth".
 */
import * as G from './gear-pair-rules.js';
import { lift3d } from './lift3d.js';

const now = () => Date.now() / 1000;
const clampTeeth = (n) => Math.max(G.TEETH_MIN, Math.min(G.TEETH_MAX, Math.round(n)));

/** what the ask means: null, or { driverTeeth?, drivenTeeth? } for a start */
export function gearsOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:please|can you|could you)\s+)?(?:explain|show(?:\s+me)?|teach\s+me|let\s+me\s+(?:play\s+with|turn|see))\s+(?:how\s+)?(?:two\s+|a\s+pair\s+of\s+|some\s+)?gears?(?:\s+(?:work|i\s+can\s+turn|turning|meshing|that\s+mesh))?$|^how\s+do\s+gears\s+work$|^(?:a\s+)?gear\s+(?:pair|train|ratio|ratios)(?:\s+explainer)?$|^gears$/.test(t)) return {};
  if (/^make\s+(?:one|the\s+(?:second|driven|other))\s+gear\s+(?:turn|spin|go)\s+twice\s+as\s+fast$/.test(t)) return { driverTeeth: 32, drivenTeeth: 16 };
  if (/^make\s+(?:one|the\s+(?:second|driven|other))\s+gear\s+(?:turn|spin|go)\s+half\s+as\s+fast$/.test(t)) return { driverTeeth: 16, drivenTeeth: 32 };
  const m = /^(?:what\s+happens\s+(?:with|when)\s+|show\s+(?:me\s+)?)?(?:a\s+)?(\d{1,2})[- ]?(?:teeth|tooth)(?:\s+gear)?\s+(?:and|with|driving|turning|to|vs\.?)\s+(?:a\s+)?(\d{1,2})[- ]?(?:teeth|tooth)(?:\s+gears?)?$/.exec(t);
  if (m) return { driverTeeth: clampTeeth(+m[1]), drivenTeeth: clampTeeth(+m[2]) };
  return null;
}

// the flat fallback: both gears drawn from the same outline the 3D uses (mm; SVG y points down, so outlines are mirrored)
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const path = (pts) => 'M' + pts.map(([x, y]) => (x * 1000).toFixed(2) + ' ' + (-y * 1000).toFixed(2)).join('L') + 'Z';

function mount(th, stageApi) {
  if (!th.state || th.state.v !== 1) th.state = G.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card gears-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(440px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Gears</span><span class="g-sub">a gear pair · drag either gear</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board gears-wrap';
  const svg = svgEl('svg', { class: 'gears-board', role: 'img', 'aria-label': 'two meshing gears' });
  svg.style.cssText = 'width:100%;height:auto;display:block;touch-action:none';
  wrap.appendChild(svg);
  const save = () => stageApi.save && stageApi.save();
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn, aria) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const commit = (next, persist = true) => { if (next === th.state) return; th.state = next; if (persist) save(); paint(); };

  // controls: tooth steppers, turn buttons, play/pause and speed, labels
  const stepper = (which, label) => {
    const box = document.createElement('div'); box.className = 'gears-stepper'; box.style.cssText = 'display:flex;align-items:center;gap:6px';
    const name = document.createElement('span'); name.textContent = label; name.style.cssText = 'min-width:84px;color:var(--muted,#9a9aa2)';
    const val = document.createElement('output'); val.className = 'gears-' + which; val.style.cssText = 'min-width:2.2em;text-align:center;font-weight:700';
    const set = (d) => commit(G.setTeeth(th.state, { [which]: clampTeeth(th.state[which] + d) }));
    box.append(name, btn('−', 'gears-less', () => set(-1), 'fewer ' + label), val, btn('+', 'gears-more', () => set(1), 'more ' + label));
    return { box, val };
  };
  const sDriver = stepper('driverTeeth', 'driver teeth'), sDriven = stepper('drivenTeeth', 'driven teeth');
  const turnRow = document.createElement('div'); turnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const playBtn = btn('Play', 'g-primary gears-play', () => commit(G.isPlaying(th.state) ? G.pause(th.state, now()) : G.play(th.state, now())));
  turnRow.append(btn('⟲ 15°', 'gears-back', () => commit(G.turnDriver(th.state, 15)), 'turn the driver 15 degrees counter-clockwise'),
    btn('15° ⟳', 'gears-fwd', () => commit(G.turnDriver(th.state, -15)), 'turn the driver 15 degrees clockwise'), playBtn);
  const speedRow = document.createElement('label'); speedRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted,#9a9aa2)';
  const speed = document.createElement('input'); speed.type = 'range'; speed.min = '-120'; speed.max = '120'; speed.step = '5'; speed.className = 'gears-speed'; speed.style.flex = '1';
  speed.addEventListener('pointerdown', (e) => e.stopPropagation());
  speed.addEventListener('input', () => commit(G.setSpeed(th.state, +speed.value, now()), false));
  speed.addEventListener('change', save);
  speedRow.append('speed', speed);
  const labels = document.createElement('label'); labels.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;color:var(--muted,#9a9aa2)';
  const labelsBox = document.createElement('input'); labelsBox.type = 'checkbox'; labelsBox.className = 'gears-labels';
  labelsBox.addEventListener('pointerdown', (e) => e.stopPropagation());
  labelsBox.addEventListener('change', () => commit({ ...th.state, showLabels: labelsBox.checked }));
  labels.append(labelsBox, 'labels: teeth, direction, ratio');
  const readouts = document.createElement('div'); readouts.className = 'gears-readouts'; readouts.style.cssText = 'margin-top:10px;display:grid;grid-template-columns:1fr auto;gap:2px 10px';
  const expl = document.createElement('div'); expl.className = 'gears-explanation g-status'; expl.setAttribute('aria-live', 'polite'); expl.style.cssText = 'display:block;margin-top:8px';
  const note = document.createElement('div'); note.className = 'g-rules'; note.textContent = 'Simplified demonstration profile, not a manufacturing model. Meshing teeth are the same size, so a gear with more teeth is bigger and turns slower.';
  el.append(wrap, sDriver.box, sDriven.box, turnRow, speedRow, labels, readouts, expl, note);

  // the flat drawing: rebuilt when the tooth counts change, posed from the rules every paint
  let built = '', gDriver = null, gDriven = null, raf = 0;
  function build() {
    const s = th.state, g = G.geometry(s), m = G.PITCH_DIAMETER_PER_TOOTH;
    while (svg.firstChild) svg.firstChild.remove();
    const r1 = (g.driverPitchRadius + m) * 1000, r2 = (g.drivenPitchRadius + m) * 1000, cd = g.centerDistance * 1000, pad = 6;
    svg.setAttribute('viewBox', [-r1 - pad, -Math.max(r1, r2) - pad, r1 + cd + r2 + 2 * pad, 2 * Math.max(r1, r2) + 2 * pad].map((v) => v.toFixed(1)).join(' '));
    const gear = (teeth, r, cx, fill, which) => {
      const grp = svgEl('g', { class: 'gears-' + which, transform: 'translate(' + cx.toFixed(2) + ' 0)', style: 'cursor:grab' }, svg);
      const rot = svgEl('g', {}, grp);
      svgEl('path', { d: path(G.toothOutline(teeth, r)), fill, stroke: 'rgba(0,0,0,.45)', 'stroke-width': 0.6 }, rot);
      svgEl('circle', { r: (r * 1000 * 0.18).toFixed(2), fill: '#1a1a1f' }, rot);
      svgEl('circle', { cx: (r * 1000 * 0.62).toFixed(2), r: (Math.max(2.2, r * 1000 * 0.08)).toFixed(2), fill: '#e0303e' }, rot); // the revolution marker
      grp.addEventListener('pointerdown', (e) => dragStart(e, which, grp));
      return rot;
    };
    gDriver = gear(s.driverTeeth, g.driverPitchRadius, 0, '#c9a24a', 'driver');
    gDriven = gear(s.drivenTeeth, g.drivenPitchRadius, cd, '#a9b2bd', 'driven');
    built = s.driverTeeth + ':' + s.drivenTeeth;
  }
  const flatShown = () => svg.getClientRects().length > 0;
  function poseFlat() {
    if (!flatShown()) return; // the 3D board is up: it poses itself from the same state
    const s = th.state; if (s.driverTeeth + ':' + s.drivenTeeth !== built) build();
    const p = G.pose(s, now());
    gDriver.setAttribute('transform', 'rotate(' + (-p.driverAngleDegrees % 360).toFixed(3) + ')');
    gDriven.setAttribute('transform', 'rotate(' + (-p.drivenAngleDegrees % 360).toFixed(3) + ')');
  }
  function loop() { raf = 0; if (!el.isConnected) return; poseFlat(); if (G.isPlaying(th.state) && flatShown()) raf = requestAnimationFrame(loop); }
  // drag either gear: the pointer's angle around that gear's centre turns it; the other follows through the rules
  function dragStart(e, which, grp) {
    e.stopPropagation(); e.preventDefault();
    const centre = () => { const b = grp.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
    const ang = (ev) => { const [cx, cy] = centre(); return Math.atan2(-(ev.clientY - cy), ev.clientX - cx) * 180 / Math.PI; };
    let last = ang(e);
    const move = (ev) => { const a = ang(ev); let d = a - last; if (d > 180) d -= 360; if (d < -180) d += 360; last = a; dragBy(which, d, false); };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); save(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  }
  function dragBy(which, deg, persist) {
    const s = th.state, t = now();
    commit(which === 'driver' ? G.turnDriver(s, deg) : G.setDrivenTravel(s, G.drivenTravel(s, t) + deg, t), persist);
  }

  function paint() {
    const s = th.state, v = G.view(s);
    sDriver.val.textContent = String(s.driverTeeth); sDriven.val.textContent = String(s.drivenTeeth);
    playBtn.textContent = G.isPlaying(s) ? 'Pause' : 'Play';
    speed.value = String(s.speed); labelsBox.checked = !!s.showLabels;
    readouts.textContent = '';
    const rows = s.showLabels ? [['Driver teeth', s.driverTeeth], ['Driven teeth', s.drivenTeeth], ['Direction', 'opposite']].concat(v.readouts.map((r) => [r.label, r.value])) : [];
    for (const [k, val] of rows) { const a = document.createElement('span'); a.style.color = 'var(--muted,#9a9aa2)'; a.textContent = k; const b = document.createElement('span'); b.style.fontWeight = '700'; b.textContent = String(val); readouts.append(a, b); }
    expl.textContent = v.explanation || '';
    poseFlat();
    if (G.isPlaying(s) && !raf) raf = requestAnimationFrame(loop);
  }
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  // in 3D: the gear pair on a small stand; it reads the state itself every frame (no re-send per move) and turns by drag
  const W = Math.min(460, (typeof innerWidth === 'number' ? innerWidth : 480) - 20); // fits a phone: the board never runs off the screen
  lift3d(th, stageApi, el, { kind: 'gears', board: svg, title: 'Gears', W, H: Math.round(W * 0.78), label: '3D gear pair: drag either gear to turn it; drag the space around to look around',
    snapshot: () => ({ state: () => th.state, now, onDrag: (which, deg, end) => dragBy(which, deg, !!end) }) });
}

async function run(text, api) {
  const q = gearsOf(text);
  if (!q) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'gears');
  if (existing) {
    if (q.driverTeeth) { existing.state = G.setTeeth(existing.state || G.create(), q); api.stage.save && api.stage.save(); api.stage.render(); }
    if (api.stage.center) api.stage.center(existing.id); else api.stage.render();
  } else api.summon('gears', { state: G.create(q), center: true });
  const s = G.create(q);
  api.say('Gears · ' + s.driverTeeth + ' teeth driving ' + s.drivenTeeth + ' · drag either gear, or press Play');
  return 'gears';
}

export default {
  name: 'gears',
  gearsOf,
  examples: ['explain gears', 'show me two gears i can turn', 'how do gears work', 'gear ratio', 'make one gear turn twice as fast', 'what happens with 12 teeth and 24 teeth', 'gears'],
  nearMisses: ['gears of war', 'bike gears', 'shift gears', 'gear up', 'what is a gear', 'buy gear'],
  match(lower, text) { return !!gearsOf(text); },
  run,
  stageKinds: { gears: { mount } },
};
