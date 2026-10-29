/**
 * breath skill - a guided breathing card that breathes with you (no key; pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "box breathing", "breathe with me", "4-7-8 breathing", "resonance breathing", "start a breathing exercise".
 * A dot travels the edge of a square (or rises and falls) in time with each phase, with the phase named, a live
 * count and the cycles done. Three named patterns: box breathing 4-4-4-4 (Cleveland Clinic, "Box Breathing"),
 * 4-7-8 (Andrew Weil's relaxing breath) and resonance breathing at 5.5 s in and out, about 5.5 breaths a minute
 * (Lehrer & Gevirtz 2014, "Heart rate variability biofeedback"). Better than a paragraph of counts: you follow it
 * instead of counting. It stops on its own when the card closes, and holds still for reduced motion.
 */
export const PATTERNS = {
  box: { label: 'Box', phases: [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]], src: 'Cleveland Clinic, "Box Breathing"' },
  '478': { label: '4-7-8', phases: [['Breathe in', 4], ['Hold', 7], ['Breathe out', 8]], src: 'Andrew Weil, the 4-7-8 relaxing breath' },
  resonance: { label: 'Resonance', phases: [['Breathe in', 5.5], ['Breathe out', 5.5]], src: 'Lehrer & Gevirtz 2014, about 5.5 breaths a minute' }
};

/** which pattern an ask wants, or null when it is not a breathing ask. Pure. */
export function breathOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  const pre = String.raw`^(?:please\s+|let'?s\s+|can\s+we\s+|i\s+want\s+to\s+|help\s+me\s+(?:do\s+)?)?(?:start\s+|do\s+|try\s+|open\s+|show\s+me\s+|give\s+me\s+)?(?:a\s+|some\s+|the\s+)?`;
  if (new RegExp(pre + String.raw`(?:4[\s-]?7[\s-]?8|four[\s-]seven[\s-]eight)\s+breath(?:ing)?(?:\s+exercise)?$`).test(t)) return '478';
  if (new RegExp(pre + String.raw`(?:resonance|coherent|resonant)\s+breathing(?:\s+exercise)?$`).test(t)) return 'resonance';
  if (new RegExp(pre + String.raw`(?:box|square)\s+breath(?:ing)?(?:\s+exercise)?$`).test(t)) return 'box';
  if (new RegExp(pre + String.raw`(?:guided\s+|calm(?:ing)?\s+|slow\s+|deep\s+)?(?:breathing\s+exercise|breathing\s+timer|breath\s?work(?:\s+session)?|breathing\s+session)$`).test(t)) return 'box';
  if (/^(?:please\s+)?(?:breathe|breath)\s+with\s+me$/.test(t) || /^help\s+me\s+breathe$/.test(t)) return 'box';
  // "help me calm down", "help me relax": a slow box breath; "i can't sleep": 4-7-8, the pattern people use to fall asleep
  if (/^(?:please\s+)?(?:help\s+me\s+(?:to\s+)?(?:calm\s+down|relax|unwind|de-?stress)|calm\s+me\s+down|i\s+need\s+to\s+(?:calm\s+down|relax))$/.test(t)) return 'box';
  if (/^i\s+(?:can'?t|cannot|can\s+not)\s+(?:sleep|fall\s+asleep|get\s+to\s+sleep)(?:\s+tonight)?$/.test(t)) return '478';
  return null;
}

/** where the guide is at `ms` into a pattern: { phase, name, left (seconds, rounded up), frac (0-1 through the phase), cycle }. Pure. */
export function stepAt(pattern, ms) {
  // the first animation frame can carry a timestamp a little before t0 (performance.now()); before the start is the start, never round -1
  ms = Math.max(0, Number(ms) || 0);
  const ph = PATTERNS[pattern].phases, total = ph.reduce((s, p) => s + p[1], 0) * 1000;
  const cycle = Math.floor(ms / total); let t = ms - cycle * total;
  for (let i = 0; i < ph.length; i++) {
    const len = ph[i][1] * 1000;
    if (t < len) return { phase: i, name: ph[i][0], left: Math.ceil((len - t) / 1000), frac: t / len, cycle };
    t -= len;
  }
  return { phase: 0, name: ph[0][0], left: Math.ceil(ph[0][1]), frac: 0, cycle: cycle + 1 };
}

/** the dot's place (0-100 box) for a step: round the square for box, up and down a column for the others. Pure. */
export function dotAt(pattern, s) {
  if (pattern === 'box') {
    const f = s.frac, side = s.phase; // in: up the left, hold: across the top, out: down the right, hold: back along the bottom
    return [[10, 90 - 80 * f], [10 + 80 * f, 10], [90, 10 + 80 * f], [90 - 80 * f, 90]][side];
  }
  const name = s.name, f = s.frac;
  const y = name === 'Breathe in' ? 90 - 80 * f : name === 'Breathe out' ? 10 + 80 * f : 10;
  return [50, y];
}

let css = false;
function style() {
  if (css || typeof document === 'undefined') return; css = true;
  const s = document.createElement('style');
  s.textContent = '.vbreath{display:flex;flex-direction:column;align-items:center;gap:12px;margin:8px 0 4px}'
    + '.vbreath svg{width:min(260px,70vw);height:auto}.vbreath .ph{font-size:24px;font-weight:300;letter-spacing:.02em;min-height:32px}'
    + '.vbreath .n{font-size:44px;font-weight:200;line-height:1;min-height:48px}.vbreath .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}'
    + '.vbreath button{font:inherit;padding:7px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:transparent;color:inherit;cursor:pointer}'
    + '.vbreath button[aria-pressed="true"]{background:rgba(124,180,255,.22);border-color:rgba(124,180,255,.6)}';
  document.head.appendChild(s);
}

function run(text, api) {
  const { showPage, esc } = api;
  let pattern = breathOf(text) || 'box';
  style();
  const el = showPage((p) => {
    p.innerHTML = '<h2>Breathe with me</h2><div class="sub">Follow the dot. Stop whenever you like.</div>' // void-review: ok (fixed markup; the only values are pattern labels from PATTERNS, through esc())
      + '<div class="vbreath"><svg viewBox="0 0 100 100" aria-hidden="true"><rect class="track" x="10" y="10" width="80" height="80" rx="6" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1.2"/>'
      + '<line class="col" x1="50" y1="10" x2="50" y2="90" stroke="rgba(255,255,255,.18)" stroke-width="1.2"/>'
      + '<circle class="dot" cx="10" cy="90" r="5" fill="#7cb4ff"/></svg>'
      + '<div class="ph" aria-live="polite">Ready</div><div class="n"></div><div class="row pats">'
      + ['box', '478', 'resonance'].map((k) => [k, PATTERNS[k]]).map(([k, v]) => '<button type="button" data-pat="' + esc(k) + '">' + esc(v.label) + '</button>').join('')
      + '</div><div class="row"><button type="button" class="go">Start</button></div><div class="sub cyc"></div></div>'
      + '<div class="src"></div>';
  });
  const $ = (s) => el.querySelector(s);
  const dot = $('.dot'), ph = $('.ph'), n = $('.n'), cyc = $('.cyc'), go = $('.go'), src = $('.src'), track = $('.track'), col = $('.col');
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t0 = 0, raf = 0, on = false, lastName = '';
  const show = () => {
    for (const b of el.querySelectorAll('[data-pat]')) b.setAttribute('aria-pressed', String(b.dataset.pat === pattern));
    track.style.display = pattern === 'box' ? '' : 'none'; col.style.display = pattern === 'box' ? 'none' : '';
    const P = PATTERNS[pattern];
    src.textContent = 'Pattern: ' + P.phases.map((x) => x[0].toLowerCase() + ' ' + x[1]).join(', ') + ' (seconds). Source: ' + P.src + '.';
    const [x, y] = dotAt(pattern, stepAt(pattern, 0)); dot.setAttribute('cx', x); dot.setAttribute('cy', y);
  };
  const frame = (now) => {
    if (!el.isConnected) { on = false; return; } // the card closed: stop
    const s = stepAt(pattern, now - t0);
    const [x, y] = dotAt(pattern, still ? { ...s, frac: 0 } : s);
    dot.setAttribute('cx', x.toFixed(2)); dot.setAttribute('cy', y.toFixed(2));
    if (s.name !== lastName) { ph.textContent = s.name; lastName = s.name; }
    n.textContent = String(s.left);
    cyc.textContent = s.cycle ? s.cycle + (s.cycle === 1 ? ' round done' : ' rounds done') : '';
    if (on) raf = requestAnimationFrame(frame);
  };
  const stop = () => { on = false; cancelAnimationFrame(raf); go.textContent = 'Start'; ph.textContent = 'Paused'; lastName = ''; };
  const start = () => { on = true; t0 = performance.now(); go.textContent = 'Stop'; raf = requestAnimationFrame(frame); };
  go.addEventListener('click', () => (on ? stop() : start()));
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-pat]'); if (!b) return;
    pattern = b.dataset.pat; const was = on; stop(); show(); n.textContent = ''; cyc.textContent = ''; ph.textContent = 'Ready'; if (was) start();
  });
  show(); start(); // it starts breathing with you right away; Stop pauses it
  return 'breath';
}

export default {
  name: 'breath',
  examples: ['box breathing', 'breathe with me', 'start a breathing exercise', '4-7-8 breathing', 'resonance breathing', 'guided breathing exercise'],
  nearMisses: ['what is breathing', 'how do lungs work', 'shortness of breath', 'why is my breath bad', 'breathing rate of a dog'],
  match(lower, text) { return !!breathOf(text || lower); },
  run,
  suite() {
    const a = breathOf('box breathing') === 'box' && breathOf('4 7 8 breathing') === '478' && breathOf('coherent breathing') === 'resonance' && breathOf('breathe with me') === 'box' && !breathOf('what is breathing');
    const s = stepAt('box', 5000), r = stepAt('478', 19000 + 12000), d = dotAt('box', { phase: 1, frac: 0.5 });
    const ok = a && s.name === 'Hold' && s.left === 3 && r.name === 'Breathe out' && r.cycle === 1 && d[0] === 50 && d[1] === 10;
    return { ok, got: ok ? 'pass' : JSON.stringify({ a, s, r, d }) };
  }
};
