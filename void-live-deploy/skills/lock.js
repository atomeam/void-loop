/**
 * lock skill — explainer.pin-lock (domains/void.explainers.md §3), frontier #17: a cutaway pin-tumbler lock. Pick a
 * demonstration key, slide it in and watch it lift the five pin pairs, then try to turn the plug: the right key sets every
 * key-pin/driver-pin boundary on the shear line; a wrong one leaves a pin across it, and the card names which. An
 * explanation of normal operation, not a lock-picking simulator. Every number comes from skills/lock-rules.js (one
 * authoritative state; tests in tools/explainers.test.mjs). The lock stands in the void in 3D (skills/mini/lock.js,
 * lifted by lift3d.js); the flat cutaway here is the fallback, drawn from the same pose().
 * "show me how a key opens a lock", "why won't the wrong key turn", "explain the pins inside a lock".
 */
import * as L from './lock-rules.js';
import { lift3d } from './lift3d.js';

/** what the ask means: null, {} for a start, { keyPreset, insertionFraction } for the wrong key, or { presentation } */
export function lockOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const lock = '(?:a\\s+|the\\s+)?(?:pin(?:[- ]tumbler)?\\s+)?locks?';
  if (new RegExp('^(?:let\\s+me\\s+)?(?:find|figure\\s+out|discover)\\s+(?:the\\s+)?rule\\s+(?:for|of|behind)\\s+' + lock + '$|^(?:mystery|discovery)\\s+lock$|^lock\\s+(?:discovery|mystery)(?:\\s+mode)?$').test(t)) return { presentation: 'discovery' };
  if (/^why\s+(?:won't|wont|doesn't|doesnt|can't|cant)\s+(?:the|a)\s+wrong\s+key\s+(?:turn|work|open\s+(?:it|the\s+lock|a\s+lock))$|^what\s+happens\s+with\s+the\s+wrong\s+key$/.test(t)) return { keyPreset: 'one-mismatch', insertionFraction: 1 };
  if (new RegExp('^(?:(?:please|can\\s+you|could\\s+you)\\s+)?show\\s+me\\s+how\\s+(?:a\\s+|the\\s+)?key\\s+opens\\s+' + lock + '$|^(?:explain|show\\s+me)\\s+the\\s+pins\\s+(?:inside|in)\\s+' + lock + '$'
    + '|^(?:show(?:\\s+me)?)\\s+the\\s+moving\\s+parts\\s+(?:of|in|inside)\\s+' + lock + '$|^how\\s+(?:does|do)\\s+' + lock + '\\s+work$|^(?:explain|show\\s+me)\\s+(?:how\\s+)?' + lock + '(?:\\s+works?)?$'
    + '|^(?:a\\s+)?(?:pin[- ]tumbler|lock)\\s+(?:cutaway|explainer)$|^lock\\s+cutaway$').test(t)) return {};
  return null;
}

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const KEY_LABEL = { 'matching': 'Matching', 'one-mismatch': 'One wrong cut', 'several-mismatch': 'Several wrong cuts' };
// the flat cutaway: side view, pin units scaled to px; y grows up in pin units, so y px = BASE - h * U
const U = 11, X0 = 46, DX = 34, BASE = 190, PIN_W = 14;

function mount(th, stageApi) {
  if (!th.state || th.state.v !== 1) th.state = L.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card lock-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(440px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Pin lock</span><span class="g-sub">a cutaway · insert the key, try to turn</span></div>';
  const save = () => stageApi.save && stageApi.save();
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn, aria) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const commit = (next, persist = true) => { if (next === th.state) return; th.state = next; if (persist) save(); paint(); };

  const wrap = document.createElement('div'); wrap.className = 'g-board lock-wrap';
  const svg = svgEl('svg', { class: 'lock-board', viewBox: '0 0 260 230', role: 'img', 'aria-label': 'a cutaway pin-tumbler lock seen from the side' });
  svg.style.cssText = 'width:100%;height:auto;display:block;touch-action:none;background:#0b0b0e;border-radius:10px';
  wrap.appendChild(svg);

  const keys = document.createElement('div'); keys.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const keyBtns = Object.keys(L.PRESETS).map((k) => { const b = btn(KEY_LABEL[k], 'lock-key', () => commit(L.setKey(th.state, k))); b.dataset.key = k; keys.append(b); return b; });
  const insRow = document.createElement('label'); insRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted,#9a9aa2)';
  const ins = stop(document.createElement('input')); ins.type = 'range'; ins.min = '0'; ins.max = '100'; ins.step = '5'; ins.className = 'lock-insertion'; ins.style.flex = '1'; ins.setAttribute('aria-label', 'how far the key is in');
  const insVal = document.createElement('output'); insVal.style.cssText = 'min-width:3em;text-align:right';
  ins.addEventListener('input', () => commit(L.setInsertion(th.state, +ins.value / 100), false)); ins.addEventListener('change', save);
  insRow.append('insertion', ins, insVal);
  const turnRow = document.createElement('div'); turnRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  turnRow.append(btn('Turn 30° ⟳', 'g-primary lock-turn', () => commit(L.turnBy(th.state, 30)), 'try to turn the plug 30 degrees'),
    btn('⟲ Back', 'lock-back', () => commit(L.turnTo(th.state, 0)), 'turn the plug back to the start'),
    btn('Reset', 'lock-reset', () => commit(L.reset(th.state))));
  const cutRow = document.createElement('label'); cutRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted,#9a9aa2)';
  const cut = stop(document.createElement('input')); cut.type = 'range'; cut.min = '0'; cut.max = '100'; cut.step = '5'; cut.className = 'lock-cutaway'; cut.style.flex = '1'; cut.setAttribute('aria-label', 'how much of the housing is cut away');
  cut.addEventListener('input', () => commit(L.setCutaway(th.state, +cut.value / 100), false)); cut.addEventListener('change', save);
  const shear = stop(document.createElement('input')); shear.type = 'checkbox'; shear.className = 'lock-shear';
  shear.addEventListener('change', () => commit({ ...th.state, showShearLine: shear.checked }));
  cutRow.append('cutaway', cut, shear, 'shear line');
  const readouts = document.createElement('div'); readouts.className = 'lock-readouts'; readouts.style.cssText = 'margin-top:10px;display:grid;grid-template-columns:1fr auto;gap:2px 10px';
  const note = document.createElement('div'); note.className = 'lock-note g-status'; note.setAttribute('aria-live', 'assertive'); note.style.cssText = 'display:block;margin-top:8px;color:#ff8a7a';
  const expl = document.createElement('div'); expl.className = 'lock-explanation g-status'; expl.setAttribute('aria-live', 'polite'); expl.style.cssText = 'display:block;margin-top:8px';
  const hint = document.createElement('div'); hint.className = 'lock-discovery g-status'; hint.style.cssText = 'display:block;margin-top:8px';
  hint.textContent = 'Find the rule: try each key, slide it all the way in and watch where each pin pair splits. Which keys let the plug turn, and why?';
  const reveal = btn('Reveal the rule', 'g-primary lock-reveal', () => commit(L.setPresentation(th.state, 'normal'))); reveal.style.marginTop = '10px';
  const foot = document.createElement('div'); foot.className = 'g-rules';
  el.append(wrap, keys, insRow, turnRow, cutRow, readouts, note, expl, hint, reveal, foot);

  function draw() {
    const s = th.state, p = L.pose(s), discovery = s.presentation === 'discovery', bad = s.lastAttempt && s.lastAttempt.reason === 'misaligned' ? s.lastAttempt.pin : -1;
    svg.textContent = '';
    const y = (h) => BASE - h * U, x = (i) => X0 + i * DX;
    // housing (cut away by the slider) and plug; the plug tints as it turns
    svgEl('rect', { x: 20, y: y(L.SPRING_TOP + 1), width: 220, height: (L.SPRING_TOP + 1 - L.SHEAR) * U, fill: '#b08d3c', opacity: String(0.25 + 0.75 * (1 - p.cutaway)) }, svg);
    svgEl('rect', { x: 20, y: y(L.SHEAR), width: 220, height: L.SHEAR * U + 8, fill: p.plug.angle ? '#8f7a3a' : '#c9a54a', opacity: String(0.25 + 0.75 * (1 - p.cutaway)) }, svg);
    for (const pr of p.pairs) {
      const cx = x(pr.i), lx = cx - PIN_W / 2;
      svgEl('rect', { x: lx - 1, y: y(L.SPRING_TOP), width: PIN_W + 2, height: (L.SPRING_TOP - 0) * U, fill: '#15151a' }, svg); // the bore
      // spring: a zigzag that only follows the driver pin
      const sb = y(pr.spring.bottom), st = y(L.SPRING_TOP), n = 8, pts = [];
      for (let k = 0; k <= n; k++) pts.push((cx + (k % 2 ? 5 : -5)) + ',' + (sb + (st - sb) * k / n));
      svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: '#9aa0a8', 'stroke-width': 1.4 }, svg);
      svgEl('rect', { x: lx, y: y(pr.driverPin.bottom + pr.driverPin.length), width: PIN_W, height: pr.driverPin.length * U - 1, rx: 2, fill: '#c3c8cf', stroke: pr.i === bad ? '#ff5c5c' : 'none', 'stroke-width': 2, class: 'lock-driver' }, svg);
      svgEl('rect', { x: lx, y: y(pr.keyPin.bottom + pr.keyPin.length), width: PIN_W, height: pr.keyPin.length * U - 1, rx: 2, fill: '#d8b25a', stroke: pr.i === bad ? '#ff5c5c' : 'none', 'stroke-width': 2, class: 'lock-keypin' }, svg);
      if (!discovery && s.showLabels !== false) svgEl('text', { x: cx, y: y(L.SPRING_TOP + 1) - 4, 'text-anchor': 'middle', 'font-size': 9, fill: pr.aligned ? '#5dffa5' : '#9a9aa2' }, svg).textContent = String(pr.i + 1);
    }
    // the key blade: its cuts under the pins, sliding in from the left
    const depth = s.insertion * L.PINS, kx = (u) => X0 - DX / 2 + (u - L.PINS + depth) * DX, pts = [[kx(0), y(-0.6)]];
    for (let j = 0; j < L.PINS; j++) { pts.push([kx(j), y(p.key.cuts[j])], [kx(j + 1) - 6, y(p.key.cuts[j])]); }
    pts.push([kx(L.PINS) + 4, y(0)], [kx(L.PINS), y(-0.6)], [kx(-2), y(-0.6)], [kx(-2), y(1.5)], [kx(0), y(1.5)]);
    svgEl('polygon', { points: pts.map(([a, b]) => a.toFixed(1) + ',' + b.toFixed(1)).join(' '), fill: '#d6d9de', stroke: '#8a8e95', 'stroke-width': 1, class: 'lock-keyblade' }, svg);
    if (s.showShearLine !== false) svgEl('line', { x1: 20, x2: 240, y1: y(L.SHEAR), y2: y(L.SHEAR), stroke: '#5dffa5', 'stroke-width': 1.2, 'stroke-dasharray': '4 3', class: 'lock-shearline' }, svg);
    // the end view: the plug's turn, so the rotation reads in the flat drawing too
    const ex = 228, ey = 24, a = p.plug.angle * Math.PI / 180;
    svgEl('circle', { cx: ex, cy: ey, r: 14, fill: '#2a2a30', stroke: '#c9a54a', 'stroke-width': 2 }, svg);
    svgEl('line', { x1: ex - Math.sin(a) * 10, y1: ey - Math.cos(a) * 10, x2: ex + Math.sin(a) * 10, y2: ey + Math.cos(a) * 10, stroke: '#d6d9de', 'stroke-width': 3 }, svg);
  }

  function paint() {
    const s = th.state, v = L.view(s), discovery = s.presentation === 'discovery';
    for (const b of keyBtns) { b.classList.toggle('g-primary', b.dataset.key === s.keyPreset); b.disabled = s.insertion !== 0 && b.dataset.key !== s.keyPreset; }
    ins.value = String(Math.round(s.insertion * 100)); insVal.textContent = Math.round(s.insertion * 100) + '%'; ins.disabled = s.angle !== 0;
    cut.value = String(Math.round(s.cutawayAmount * 100)); shear.checked = s.showShearLine !== false;
    readouts.textContent = '';
    for (const r of [{ label: 'Key', value: KEY_LABEL[s.keyPreset] }, { label: 'Plug angle', value: Math.round(s.angle) + '°' }].concat(v.readouts)) {
      const k = document.createElement('span'); k.style.color = 'var(--muted,#9a9aa2)'; k.textContent = r.label;
      const b = document.createElement('span'); b.style.fontWeight = '700'; b.textContent = String(r.value); readouts.append(k, b);
    }
    note.textContent = v.note || ''; expl.textContent = v.explanation || '';
    hint.style.display = reveal.style.display = discovery ? '' : 'none';
    foot.textContent = v.notes.join(' ') + (s.angle ? ' Turn back to the start to take the key out.' : '');
    draw();
  }
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  const W = Math.min(460, (typeof innerWidth === 'number' ? innerWidth : 480) - 20);
  lift3d(th, stageApi, el, { kind: 'lock', board: svg, title: 'Pin lock', W, H: Math.round(W * 0.78), label: '3D pin lock cutaway: drag the key to slide it in or out; drag the space around to look around',
    snapshot: () => ({ state: () => th.state, onInsert: (f, end) => commit(L.setInsertion(th.state, f), !!end) }) });
}

async function run(text, api) {
  const q = lockOf(text);
  if (!q) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'lock');
  if (q.presentation) {
    if (existing) existing.state = L.setPresentation(existing.state || L.create(), q.presentation);
    else api.summon('lock', { state: L.setPresentation(L.create(), q.presentation), center: true });
    if (existing) { api.stage.save && api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(existing.id); }
    api.say('Find the rule · the readouts are hidden · try each key, slide it in, watch the pins · Reveal the rule when ready');
    return 'lock';
  }
  const start = (s0) => (q.keyPreset ? L.setInsertion(L.setKey(L.reset(s0), q.keyPreset), q.insertionFraction) : s0);
  if (existing) { existing.state = start(existing.state || L.create()); api.stage.save && api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(existing.id); }
  else api.summon('lock', { state: start(L.create()), center: true });
  api.say(q.keyPreset ? 'The wrong key, all the way in · pin pair 3 still crosses the shear line · press Turn and see' : 'Pin lock · pick a key, slide it in, press Turn');
  return 'lock';
}

export default {
  name: 'lock',
  lockOf,
  examples: ['show me how a key opens a lock', "why won't the wrong key turn", 'explain the pins inside a lock', 'show the moving parts of a lock', 'how does a lock work', 'how do pin tumbler locks work', 'lock cutaway', 'mystery lock'],
  nearMisses: ['lock my screen', 'lock the door', 'how to pick a lock', 'locksmith near me', 'lock screen', 'what is a deadlock', 'show the moving parts'],
  match(lower, text) { return !!lockOf(text); },
  run,
  // the ports a taker (the quiz, the challenge) reads off this card, unchanged: void.observations.v1 and the explanation
  stageKinds: { lock: { mount, gives: { observations: (th) => L.observations(th.state || L.create()), explanation: (th) => L.explanation(th.state || L.create()) } } },
};
