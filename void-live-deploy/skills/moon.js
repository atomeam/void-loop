/**
 * moon skill — explainer.moon-phases (domains/void.explainers.md): a small Earth and Moon with sunlight from one side.
 * Drag the Moon round its orbit and the "view from Earth" disc shows the phase it makes. Every number comes from
 * skills/moon-phases-rules.js (one authoritative state; tests in tools/explainers.test.mjs). The Earth and Moon stand in
 * the void in 3D (skills/mini/moon.js, lifted by lift3d.js with this card beside it); the flat top-down drawing here is the
 * fallback. The Earth-view disc is drawn from the same state in both, never from separate artwork.
 * "explain moon phases", "why is a half moon called a quarter moon", "waxing vs waning", "let me move the moon around earth".
 */
import * as M from './moon-phases-rules.js';
import { lift3d } from './lift3d.js';

const now = () => Date.now() / 1000;
const SYNODIC = 29.530588853, NEW_2000 = Date.UTC(2000, 0, 6, 18, 14) / 1000; // a known new moon and the mean phase cycle
/** tonight's orbital angle under this card's convention (0° new): from the mean cycle, within about a day */
export const tonightAngle = (t = now()) => { const age = (((t - NEW_2000) / 86400) % SYNODIC + SYNODIC) % SYNODIC; return Math.round(age / SYNODIC * 3600) / 10; };

/** what the ask means: null, or { orbitAngleDegrees?, phaseName?, presentation? } */
export function moonOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const phases = '(?:the\\s+)?(?:moon(?:\'s)?\\s+phases?|phases?\\s+of\\s+the\\s+moon|lunar\\s+phases?)';
  if (new RegExp('^(?:let\\s+me\\s+)?(?:find|figure\\s+out|discover)\\s+(?:the\\s+)?rule\\s+(?:for|of|behind)\\s+' + phases + '$|^(?:moon\\s+phases?|moon)\\s+(?:discovery|mystery)(?:\\s+mode)?$|^mystery\\s+moon(?:\\s+phases?)?$').test(t)) return { presentation: 'discovery' };
  if (new RegExp('^(?:(?:please|can\\s+you|could\\s+you)\\s+)?(?:explain|show(?:\\s+me)?|teach\\s+me(?:\\s+about)?|help\\s+me\\s+understand)\\s+' + phases + '$|^(?:the\\s+)?(?:moon\\s+phases|phases\\s+of\\s+the\\s+moon|lunar\\s+phases)(?:\\s+explained|\\s+explainer)?$'
    + '|^(?:how\\s+do|what\\s+causes|what\\s+makes|why\\s+(?:are\\s+there|do\\s+we\\s+(?:have|get|see)))\\s+' + phases + '(?:\\s+work|\\s+happen)?$|^why\\s+does\\s+the\\s+moon\\s+(?:have\\s+phases|change\\s+shape)$'
    + '|^(?:are|is)\\s+' + phases + '\\s+caused\\s+by\\s+(?:the\\s+)?earth\'?s\\s+shadow$|^(?:let\\s+me\\s+)?(?:move|drag|turn|orbit)\\s+the\\s+moon(?:\\s+(?:around|round)\\s+(?:the\\s+)?earth)?$|^(?:show\\s+me\\s+)?the\\s+moon\\s+orbiting\\s+(?:the\\s+)?earth$').test(t)) return {};
  if (/^why\s+is\s+(?:a\s+)?half\s+moon\s+called\s+a\s+(?:first\s+|last\s+)?quarter(?:\s+moon)?$|^why\s+is\s+it\s+called\s+a\s+quarter\s+moon$|^what\s+is\s+a\s+(?:first\s+)?quarter\s+moon$/.test(t)) return { phaseName: 'first-quarter' };
  if (/^(?:show\s+me\s+)?(?:the\s+)?difference\s+between\s+waxing\s+and\s+waning(?:\s+moons?)?$|^waxing\s+(?:vs\.?|versus|or|and)\s+waning(?:\s+moons?)?$|^what\s+(?:does|do)\s+waxing\s+and\s+waning\s+mean$|^what\s+is\s+a\s+waxing\s+(?:crescent|gibbous)(?:\s+moon)?$/.test(t)) return { phaseName: 'waxing-crescent' };
  if (/^(?:explain|show\s+me)\s+tonight'?s\s+moon(?:\s+in\s+3d)?$|^why\s+does\s+tonight'?s\s+moon\s+look\s+like\s+(?:that|this)$/.test(t)) return { orbitAngleDegrees: tonightAngle() };
  return null;
}

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
/** the lit part of the Earth-view disc (radius r): the same region litInEarthView tests, traced as a polygon */
export function litPath(s, t, r = 1, n = 48) {
  const a = M.orbitAngle(s, t), c = Math.cos(a * Math.PI / 180), pts = [];
  const w = (y) => Math.sqrt(Math.max(0, 1 - y * y));
  const [outer, inner] = a <= 180 ? [(y) => w(y), (y) => c * w(y)] : [(y) => -w(y), (y) => -c * w(y)];
  for (let i = 0; i <= n; i++) { const y = -1 + 2 * i / n; pts.push([outer(y), y]); }
  for (let i = n; i >= 0; i--) { const y = -1 + 2 * i / n; pts.push([inner(y), y]); }
  return 'M' + pts.map(([x, y]) => (x * r).toFixed(2) + ' ' + (y * r).toFixed(2)).join('L') + 'Z';
}

function mount(th, stageApi) {
  if (!th.state || th.state.v !== 1) th.state = M.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card moon-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(440px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Moon phases</span><span class="g-sub">drag the Moon round Earth</span></div>';
  const save = () => stageApi.save && stageApi.save();
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn, aria) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const commit = (next, persist = true) => { if (next === th.state) return; th.state = next; if (persist) save(); paint(); };

  // the overview, seen from above the north pole: sunlight from the right, Earth in the middle, the Moon on its orbit
  const wrap = document.createElement('div'); wrap.className = 'g-board moon-wrap';
  const svg = svgEl('svg', { class: 'moon-board', viewBox: '-130 -110 260 220', role: 'img', 'aria-label': 'Earth and Moon seen from above, sunlight from the right' });
  svg.style.cssText = 'width:100%;height:auto;display:block;touch-action:none;background:#050508;border-radius:10px';
  wrap.appendChild(svg);
  const R = 80;
  const defs = svgEl('defs', {}, svg);
  const grad = svgEl('linearGradient', { id: 'moon-lit-' + th.id, x1: '0', x2: '1', y1: '0', y2: '0' }, defs);
  svgEl('stop', { offset: '0.5', 'stop-color': '#16161c' }, grad); svgEl('stop', { offset: '0.5', 'stop-color': '#e8e4d8' }, grad);
  const egrad = svgEl('linearGradient', { id: 'earth-lit-' + th.id, x1: '0', x2: '1', y1: '0', y2: '0' }, defs);
  svgEl('stop', { offset: '0.5', 'stop-color': '#0d1a2e' }, egrad); svgEl('stop', { offset: '0.5', 'stop-color': '#3d7fd0' }, egrad);
  const sun = svgEl('g', { class: 'moon-sunlight' }, svg);
  for (const y of [-72, -36, 0, 36, 72]) { svgEl('line', { x1: 126, y1: y, x2: 104, y2: y, stroke: '#ffcf5a', 'stroke-width': 1.6 }, sun); svgEl('path', { d: 'M104 ' + y + 'l6 -4v8z', fill: '#ffcf5a' }, sun); }
  const sunLabel = svgEl('text', { x: 118, y: -84, 'text-anchor': 'end', fill: '#ffcf5a', 'font-size': 9 }, sun); sunLabel.textContent = 'sunlight';
  svgEl('circle', { r: R, fill: 'none', stroke: 'rgba(255,255,255,.18)', 'stroke-dasharray': '3 4' }, svg);
  svgEl('circle', { r: 16, fill: 'url(#earth-lit-' + th.id + ')', stroke: 'rgba(255,255,255,.25)', 'stroke-width': 0.6 }, svg);
  const earthLabel = svgEl('text', { y: 30, 'text-anchor': 'middle', fill: '#9a9aa2', 'font-size': 9 }, svg); earthLabel.textContent = 'Earth';
  const moonG = svgEl('g', { class: 'moon-moon', style: 'cursor:grab' }, svg);
  svgEl('circle', { r: 16, fill: 'transparent' }, moonG); // a finger-sized target round the small Moon
  svgEl('circle', { r: 8, fill: 'url(#moon-lit-' + th.id + ')', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 0.6 }, moonG);
  const sight = svgEl('line', { x1: 0, y1: 0, stroke: 'rgba(255,255,255,.28)', 'stroke-width': 0.8, 'stroke-dasharray': '2 3' }, svg);
  svg.insertBefore(sight, moonG);

  // the view from Earth: north up, right limb lit while waxing; a separate drawing so it stays on the card in 3D
  const viewBox = document.createElement('div'); viewBox.className = 'moon-earthview'; viewBox.style.cssText = 'display:flex;align-items:center;gap:12px;margin-top:10px';
  const ev = svgEl('svg', { viewBox: '-52 -52 104 104', role: 'img', 'aria-label': 'the Moon as seen from Earth' });
  ev.style.cssText = 'width:104px;height:104px;flex:none;background:#050508;border-radius:50%';
  svgEl('circle', { r: 46, fill: '#1b1b22' }, ev);
  const lit = svgEl('path', { fill: '#ece7d9' }, ev);
  svgEl('circle', { r: 46, fill: 'none', stroke: 'rgba(255,255,255,.25)', 'stroke-width': 0.8 }, ev);
  const evText = document.createElement('div'); evText.style.cssText = 'flex:1;min-width:0';
  const evTitle = document.createElement('div'); evTitle.style.cssText = 'font-weight:700'; evTitle.textContent = 'Seen from Earth';
  const evPhase = document.createElement('div'); evPhase.className = 'moon-phase'; evPhase.style.cssText = 'font-size:20px;font-weight:700;margin:2px 0';
  const evSub = document.createElement('div'); evSub.className = 'moon-sub'; evSub.style.cssText = 'color:var(--muted,#9a9aa2)';
  evText.append(evTitle, evPhase, evSub); viewBox.append(ev, evText);

  // controls: the orbit slider, phase shortcuts, play and cycle length, the two toggles
  const orbitRow = document.createElement('label'); orbitRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:10px;color:var(--muted,#9a9aa2)';
  const orbit = document.createElement('input'); orbit.type = 'range'; orbit.min = '0'; orbit.max = '359'; orbit.step = '1'; orbit.className = 'moon-orbit'; orbit.style.flex = '1';
  orbit.setAttribute('aria-label', 'orbital position in degrees from new moon');
  orbit.addEventListener('pointerdown', (e) => e.stopPropagation());
  orbit.addEventListener('input', () => commit(M.setOrbit(M.pause(th.state, now()), +orbit.value, now()), false));
  orbit.addEventListener('change', save);
  const orbitVal = document.createElement('output'); orbitVal.style.cssText = 'min-width:3.2em;text-align:right;font-weight:700';
  orbitRow.append('orbit', orbit, orbitVal);
  const phaseRow = document.createElement('div'); phaseRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const go = (id) => commit(M.setPhase(M.pause(th.state, now()), id, now()));
  phaseRow.append(btn('New', 'moon-new', () => go('new-moon')), btn('First quarter', 'moon-first', () => go('first-quarter')), btn('Full', 'moon-full', () => go('full-moon')),
    btn('Last quarter', 'moon-last', () => go('last-quarter')), btn('Tonight', 'moon-tonight', () => commit(M.setOrbit(M.pause(th.state, now()), tonightAngle(), now())), "move the Moon to tonight's phase"));
  const playRow = document.createElement('div'); playRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted,#9a9aa2)';
  const playBtn = btn('Play', 'g-primary moon-play', () => commit(M.isPlaying(th.state) ? M.pause(th.state, now()) : M.play(th.state, now())));
  const cycle = document.createElement('input'); cycle.type = 'range'; cycle.min = '10'; cycle.max = '120'; cycle.step = '5'; cycle.className = 'moon-cycle'; cycle.style.flex = '1';
  cycle.setAttribute('aria-label', 'seconds per animated cycle');
  cycle.addEventListener('pointerdown', (e) => e.stopPropagation());
  cycle.addEventListener('input', () => commit(M.setCycle(th.state, +cycle.value, now()), false));
  cycle.addEventListener('change', save);
  const cycleVal = document.createElement('output'); cycleVal.style.cssText = 'min-width:3.6em;text-align:right';
  playRow.append(playBtn, cycle, cycleVal);
  const toggles = document.createElement('div'); toggles.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;color:var(--muted,#9a9aa2)';
  const toggle = (key, text, cls) => {
    const l = document.createElement('label'); l.style.cssText = 'display:flex;align-items:center;gap:6px';
    const b = document.createElement('input'); b.type = 'checkbox'; b.className = cls;
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('change', () => commit({ ...th.state, [key]: b.checked })); // display only: no revision
    l.append(b, text); toggles.append(l); return b;
  };
  const sunBox = toggle('showSunlight', 'sunlight arrows', 'moon-show-sun'), viewToggle = toggle('showEarthView', 'view from Earth', 'moon-show-view');
  const readouts = document.createElement('div'); readouts.className = 'moon-readouts'; readouts.style.cssText = 'margin-top:10px;display:grid;grid-template-columns:1fr auto;gap:2px 10px';
  const expl = document.createElement('div'); expl.className = 'moon-explanation g-status'; expl.setAttribute('aria-live', 'polite'); expl.style.cssText = 'display:block;margin-top:8px';
  const hint = document.createElement('div'); hint.className = 'moon-discovery g-status'; hint.style.cssText = 'display:block;margin-top:8px';
  hint.textContent = 'Find the rule: drag the Moon round Earth and watch the view from Earth. Which half of the Moon is always lit, and why do we see more or less of it?';
  const reveal = btn('Reveal the rule', 'g-primary moon-reveal', () => commit(M.setPresentation(th.state, 'normal')));
  reveal.style.marginTop = '10px';
  const note = document.createElement('div'); note.className = 'g-rules'; note.textContent = M.SCENE_NOTE + ' Demonstration time, not astronomical time: the Moon orbits in 27.3 days and the phases repeat every 29.5.';
  el.append(wrap, viewBox, orbitRow, phaseRow, playRow, toggles, readouts, expl, hint, reveal, note);

  // drag the Moon: its angle round Earth is the orbital position (0° toward the Sun, counter-clockwise seen from above)
  moonG.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    const at = (ev2) => { const b = svg.getBoundingClientRect(), sx = 260 / b.width, x = (ev2.clientX - b.left) * sx - 130, y = (ev2.clientY - b.top) * (220 / b.height) - 110; return Math.atan2(-y, x) * 180 / Math.PI; };
    commit(M.pause(th.state, now()), false);
    const move = (ev2) => setAngle(at(ev2), false);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); save(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  function setAngle(deg, persist) { commit(M.setOrbit(M.pause(th.state, now()), deg, now()), persist); }

  let raf = 0;
  function poseFlat() {
    const s = th.state, t = now(), [x, , z] = M.moonPosition(s, t);
    moonG.setAttribute('transform', 'translate(' + (x * R).toFixed(2) + ' ' + (z * R).toFixed(2) + ')');
    sight.setAttribute('x2', (x * (R - 9)).toFixed(2)); sight.setAttribute('y2', (z * (R - 9)).toFixed(2));
    lit.setAttribute('d', litPath(s, t, 46));
  }
  function paint() {
    const s = th.state, t = now(), v = M.view(s, t), a = M.orbitAngle(s, t), discovery = s.presentation === 'discovery';
    orbit.value = String(Math.round(a) % 360); orbitVal.textContent = Math.round(a) + '°';
    cycle.value = String(s.secondsPerCycle); cycleVal.textContent = s.secondsPerCycle + ' s';
    playBtn.textContent = M.isPlaying(s) ? 'Pause' : 'Play';
    sunBox.checked = s.showSunlight !== false; viewToggle.checked = s.showEarthView !== false;
    sun.style.display = s.showSunlight === false ? 'none' : '';
    viewBox.style.display = s.showEarthView === false ? 'none' : 'flex';
    // discovery hides the answer (the phase, the lit fraction, the explanation), never the inputs, the drawing or the controls
    evTitle.textContent = 'Seen from Earth';
    evPhase.textContent = discovery ? '' : v.readouts[1].value;
    evSub.textContent = discovery ? 'north up' : v.readouts[0].value + ' lit · north up';
    readouts.textContent = '';
    for (const r of [{ label: 'Orbital position', value: v.inputs.orbitAngleDegrees + '°' }].concat(v.readouts)) {
      const k = document.createElement('span'); k.style.color = 'var(--muted,#9a9aa2)'; k.textContent = r.label;
      const b = document.createElement('span'); b.style.fontWeight = '700'; b.textContent = String(r.value); readouts.append(k, b);
    }
    expl.textContent = v.explanation || '';
    hint.style.display = reveal.style.display = discovery ? '' : 'none';
    poseFlat();
    if (M.isPlaying(s) && !raf) raf = requestAnimationFrame(loop);
  }
  // while playing, the whole card follows the clock (the readouts change with the phase), a few times a second is plenty
  let lastPaint = 0;
  function loop(ts) { raf = 0; if (!el.isConnected || !M.isPlaying(th.state)) return; if (!lastPaint || ts - lastPaint > 120) { lastPaint = ts; paint(); } else poseFlat(); raf = requestAnimationFrame(loop); }
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  // in 3D: Earth and Moon lit from one side; it reads the state itself every frame and the Moon turns by drag
  const W = Math.min(460, (typeof innerWidth === 'number' ? innerWidth : 480) - 20);
  lift3d(th, stageApi, el, { kind: 'moon', board: svg, title: 'Moon phases', W, H: Math.round(W * 0.78), label: '3D Earth and Moon: drag the Moon round its orbit; drag the space around to look around',
    snapshot: () => ({ state: () => th.state, now, onDrag: (deg, end) => setAngle(deg, !!end) }) });
}

async function run(text, api) {
  const q = moonOf(text);
  if (!q) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'moon');
  if (q.presentation) {
    // display only: the Moon, its state and what the card gives a taker stay exactly as they were
    if (existing) existing.state = M.setPresentation(existing.state || M.create(), q.presentation);
    else api.summon('moon', { state: M.setPresentation(M.create(), q.presentation), center: true });
    if (existing) { api.stage.save && api.stage.save(); api.stage.render(); if (api.stage.center) api.stage.center(existing.id); }
    api.say('Find the rule · the phase names are hidden · drag the Moon and watch the view from Earth · Reveal the rule when ready');
    return 'moon';
  }
  const start = q.phaseName !== undefined || q.orbitAngleDegrees !== undefined;
  if (existing) {
    if (start) { const s0 = existing.state || M.create(); existing.state = q.phaseName ? M.setPhase(M.pause(s0, now()), q.phaseName, now()) : M.setOrbit(M.pause(s0, now()), q.orbitAngleDegrees, now()); api.stage.save && api.stage.save(); api.stage.render(); }
    if (api.stage.center) api.stage.center(existing.id); else api.stage.render();
  } else api.summon('moon', { state: M.create(q), center: true });
  const s = M.create(q), name = M.PHASES.find((x) => x.id === M.phaseName(s)).label;
  api.say(q.phaseName === 'first-quarter' ? 'First quarter · half the disc is lit, but the Moon is a quarter of the way round its orbit · drag it and see'
    : q.phaseName === 'waxing-crescent' ? 'Waxing grows, waning shrinks · the lit part is on the right while waxing (seen from the north) · drag the Moon past full and watch it flip'
    : 'Moon phases · ' + name + ' · drag the Moon round Earth, or press Play');
  return 'moon';
}

export default {
  name: 'moon',
  moonOf,
  examples: ['explain moon phases', 'how do moon phases work', 'what causes the phases of the moon', 'why is a half moon called a quarter moon', 'show me the difference between waxing and waning', 'let me move the moon around earth', 'moon phases', 'mystery moon'],
  nearMisses: ['moon phase tonight', 'what is the moon phase today', 'when is the next full moon', 'how far is the moon', 'moon river', 'fly me to the moon'],
  match(lower, text) { return !!moonOf(text); },
  run,
  stageKinds: { moon: { mount } },
};
