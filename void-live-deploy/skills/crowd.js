/**
 * crowd skill - the crowd engine (owner, 2026-10-18, the Opposite Era; made with tools/new-skill.mjs). "summon the crowd" fills
 * the layer behind the stage (the page's world layer, as the night sky uses) with anonymous particles that react to what you do:
 * they cheer (rise) when a thing is added, flee from the spot where one is removed, swarm toward a thing you drag, and after
 * 10 s with nothing happening they spell V01D. The crowd grows with how many things changed in the last minute (sizeFor).
 * "dismiss the crowd" clears it. Nothing is saved and nothing leaves the device. The particle law (create, step, moodOf,
 * sizeFor, spellPoints) is pure and seeded; tested in tools/stage-pack-f.test.mjs. One world at a time: the crowd replaces the sky.
 */
import { rng, makeParticles, integrate, clamp } from '../lib/field-kit.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** 'summon' | 'dismiss' | null. Pure. */
export function crowdOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?(?:summon|call|bring|raise|gather)\s+(?:the\s+|a\s+)?crowd(?:\s+(?:in|here|behind\s+the\s+stage))?$/.test(t) || /^(?:a\s+)?crowd(?:\s+please)?$/.test(t)) return 'summon';
  if (/^(?:please\s+)?(?:dismiss|disperse|clear|send\s+(?:away|home)|release)\s+(?:the\s+)?crowd$/.test(t) || /^(?:please\s+)?send\s+(?:the\s+)?crowd\s+(?:home|away)$/.test(t) || /^(?:the\s+)?crowd\s+(?:away|go\s+home|leave)$/.test(t)) return 'dismiss';
  return null;
}

export const MIN = 40, MAX = 400, IDLE_MS = 10000, MOOD_MS = 2500, WORD = 'V01D';
/** how many in the crowd for `changes` things changed in the last minute. Pure. */
export const sizeFor = (changes) => clamp(MIN + 25 * Math.max(0, Math.floor(+changes) || 0), MIN, MAX);
/** how many of `times` (ms) fall in the last minute before `now`. Pure. */
export const recent = (times, now) => (times || []).filter((t) => now - t >= 0 && now - t < 60000).length;
/** the mood for the last event { type: 'added' | 'removed' | 'drag', at } at `now`: cheer, flee, swarm, spell after IDLE_MS, else idle. Pure. */
export function moodOf(last, now) {
  if (!last || !Number.isFinite(last.at)) return 'idle';
  const age = now - last.at;
  if (age >= IDLE_MS) return 'spell';
  if (last.type === 'drag') return age < 800 ? 'swarm' : 'idle';
  if (age < MOOD_MS) return last.type === 'added' ? 'cheer' : last.type === 'removed' ? 'flee' : 'idle';
  return 'idle';
}

// a 5x7 bitmap font for the letters the crowd spells
const FONT = {
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  D: ['11100', '10010', '10001', '10001', '10001', '10010', '11100'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
};
/** the unit-square points that spell `word`, centred, letter cells `cell` wide (aspect 1 assumed; the canvas corrects for it). Pure. */
export function spellPoints(word = WORD, cell = 0.028) {
  const letters = String(word).toUpperCase().split('').map((c) => FONT[c] || FONT.O), gap = cell, w = letters.length * (5 * cell + gap) - gap, h = 7 * cell;
  const x0 = 0.5 - w / 2, y0 = 0.5 - h / 2, pts = [];
  letters.forEach((rows, li) => rows.forEach((row, r) => row.split('').forEach((b, c) => { if (b === '1') pts.push({ x: x0 + li * (5 * cell + gap) + (c + 0.5) * cell, y: y0 + (r + 0.5) * cell }); })));
  return pts;
}

/** a crowd of n, seeded. */
export function create(seed = 1, n = MIN) {
  const rand = rng(seed), p = makeParticles(n, rand, 0.02);
  return { ...p, rand, seed, mood: 'idle', target: null, points: spellPoints(), tint: 0 };
}
/** the crowd grown or thinned to n (newcomers arrive at random spots). */
export function resize(s, n) {
  n = Math.max(1, Math.floor(n)); if (n === s.n) return s;
  const grow = (arr, fill) => { const a = new Float32Array(n); a.set(arr.subarray(0, Math.min(n, s.n))); for (let i = s.n; i < n; i++) a[i] = fill(); return a; };
  s.x = grow(s.x, () => s.rand()); s.y = grow(s.y, () => s.rand()); s.vx = grow(s.vx, () => 0); s.vy = grow(s.vy, () => 0); s.n = n;
  return s;
}
/** one frame: the law for the mood. target: { x, y } in the unit square (where a thing was removed, or the dragged thing). Changes s. */
export function step(s, dt, mood = s.mood, target = s.target) {
  s.mood = mood; s.target = target;
  const n = s.n, r = s.rand, tx = target ? target.x : 0.5, ty = target ? target.y : 0.5;
  for (let i = 0; i < n; i++) {
    const dx = tx - s.x[i], dy = ty - s.y[i], d = Math.hypot(dx, dy) || 1e-6;
    if (mood === 'cheer') { s.vy[i] -= 1.6 * dt; s.vx[i] += (r() - 0.5) * 0.6 * dt; }
    else if (mood === 'flee') { const push = 2.4 * dt / (0.25 + d); s.vx[i] -= (dx / d) * push; s.vy[i] -= (dy / d) * push; }
    else if (mood === 'swarm') { s.vx[i] += dx * 3.2 * dt; s.vy[i] += dy * 3.2 * dt; }
    else if (mood === 'spell') { const p = s.points[i % s.points.length]; s.vx[i] += (p.x - s.x[i]) * 5 * dt; s.vy[i] += (p.y - s.y[i]) * 5 * dt; }
    else { s.vx[i] += (r() - 0.5) * 0.12 * dt; s.vy[i] += (r() - 0.5) * 0.12 * dt; }
  }
  const drag = mood === 'spell' ? 4.5 : mood === 'swarm' ? 2.5 : mood === 'cheer' ? 0.4 : 1.6;
  integrate(s, dt, drag, mood === 'cheer' || mood === 'idle'); // cheering and idling wrap (the risers come back from below); the rest bounce
  return s;
}
/** the crowd's numbers: mean y, mean vertical speed (cheering makes it negative: up), mean distance to the target, the share within `near` of a spelt point. Pure. */
export function measure(s, near = 0.02) {
  let sy = 0, svy = 0, sd = 0, on = 0; const tx = s.target ? s.target.x : 0.5, ty = s.target ? s.target.y : 0.5;
  for (let i = 0; i < s.n; i++) { sy += s.y[i]; svy += s.vy[i]; sd += Math.hypot(tx - s.x[i], ty - s.y[i]); const p = s.points[i % s.points.length]; if (Math.hypot(p.x - s.x[i], p.y - s.y[i]) < near) on++; }
  return { meanY: sy / s.n, meanVy: svy / s.n, meanDist: sd / s.n, spelt: on / s.n };
}

// ---- the layer -----------------------------------------------------------------------------------------------------------------
const TINT = { idle: '200,210,255', cheer: '255,214,120', flee: '255,120,120', swarm: '140,200,255', spell: '255,255,255' };
const world = {
  mount(host, ctx) {
    const opts = ctx.opts || {}, st = opts.stage || null, cv = document.createElement('canvas');
    cv.className = 'crowd'; cv.style.cssText = 'width:100%;height:100%;display:block'; host.appendChild(cv);
    const g = cv.getContext('2d'), s = create(((Date.now() % 100000) + 1) >>> 0, MIN), times = [];
    let last = null, seen = new Set(), places = new Map(), raf = 0, prev = performance.now(), drags = 0;
    const unit = (x, y) => ({ x: clamp(x / Math.max(1, innerWidth), 0, 1), y: clamp(y / Math.max(1, innerHeight), 0, 1) });
    const look = () => { // what changed on the stage since the last look: a thing added cheers the crowd, one removed sends it fleeing from where it stood
      if (!st) return; const things = st.things(), ids = new Set(Object.keys(things)), rect = st.stage.getBoundingClientRect(), now = Date.now();
      for (const id of ids) if (!seen.has(id)) { last = { type: 'added', at: now }; times.push(now); }
      for (const id of seen) if (!ids.has(id)) { const p = places.get(id); last = { type: 'removed', at: now }; s.target = p ? unit(rect.left + p.x + 40, rect.top + p.y + 30) : null; times.push(now); }
      seen = ids; places = new Map(Object.values(things).map((t) => [t.id, { x: +t.x || 0, y: +t.y || 0 }]));
    };
    look(); last = { type: 'start', at: Date.now() }; // the things already there are the audience's scenery, not news; the word comes after 10 quiet seconds
    const onChange = () => look();
    const onMove = (e) => { if (!document.documentElement.classList.contains('dragging')) return; last = { type: 'drag', at: Date.now() }; s.target = unit(e.clientX, e.clientY); if (++drags % 30 === 0) times.push(Date.now()); };
    addEventListener('void:stage-change', onChange); document.addEventListener('pointermove', onMove);
    const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(1, Math.floor(innerWidth * dpr)); cv.height = Math.max(1, Math.floor(innerHeight * dpr)); };
    size(); addEventListener('resize', size);
    const draw = () => {
      const w = cv.width, h = cv.height, dot = Math.max(1.5, w / 700);
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(' + TINT[s.mood] + ',.75)';
      const ax = s.mood === 'spell' ? Math.min(1, h / w) : 1, ox = s.mood === 'spell' ? (1 - ax) / 2 : 0; // the word keeps square cells on a wide screen
      for (let i = 0; i < s.n; i++) { const x = (ox + s.x[i] * ax) * w, y = s.y[i] * h; g.beginPath(); g.arc(x, y, dot, 0, 6.2832); g.fill(); }
    };
    const frame = (t) => {
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
      const now = Date.now(), mood = moodOf(last, now), want = sizeFor(recent(times, now));
      if (want !== s.n) resize(s, want);
      step(s, dt, mood, s.target); draw();
      window.__voidCrowd = { n: s.n, mood: s.mood, changes: recent(times, now) };
      raf = requestAnimationFrame(frame);
    };
    if (ctx.still) { step(s, 1 / 60, 'idle'); draw(); window.__voidCrowd = { n: s.n, mood: 'idle', changes: 0 }; } else raf = requestAnimationFrame(frame);
    return { update: draw, dispose() { cancelAnimationFrame(raf); removeEventListener('void:stage-change', onChange); document.removeEventListener('pointermove', onMove); removeEventListener('resize', size); delete window.__voidCrowd; } };
  },
};

async function run(text, api) {
  const q = crowdOf(text);
  if (!q || !api.stage || !api.stage.setWorld) return 'none';
  if (q === 'dismiss') { if (api.stage.world() === 'crowd') { api.stage.setWorld(null); api.say('the crowd disperses'); } else api.say('no crowd here'); return 'crowd'; }
  api.stage.setWorld('crowd', { stage: api.stage });
  api.say('the crowd is in: it cheers what you add, flees what you remove, follows what you drag, and spells V01D when you pause · "dismiss the crowd" clears it');
  return 'crowd';
}

export default {
  name: 'crowd',
  examples: ['summon the crowd', 'dismiss the crowd', 'bring the crowd in', 'disperse the crowd'],
  nearMisses: ['crowdfunding', 'crowd control tips', 'how big is the crowd at wembley', 'a crowded train', 'summon a figure'],
  match(lower, text) { return !!crowdOf(text); },
  run,
  world,
};
